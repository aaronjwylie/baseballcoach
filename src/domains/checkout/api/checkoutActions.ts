"use server";
/**
 * The customer flow's verbs.
 *
 * Server Actions rather than API routes, for the same reason the admin portal
 * uses them: the browser needs a typed answer, not an HTTP contract, and every
 * one of these reads the flow cookie, which is a server concern anyway. The only
 * things left as routes are the ones that genuinely need HTTP — raw upload
 * bodies, the Blob token handshake, and Stripe's webhook.
 *
 * **Every action re-derives the submission from the cookie.** None of them
 * accepts a submission id from the browser, so there is nothing to tamper with.
 */
import { headers } from "next/headers";
import { clientIdentifierFrom, rateLimit } from "@/shared/lib";
import {
  createSubmission,
  getSubmission,
  isPaid,
  listSubmissionFiles,
  parseSubmissionInput,
  readFlowSession,
  setFlowSession,
  clearFlowSession,
  updateDraftDetails,
  type SubmissionFile,
} from "@/domains/submission";
import {
  VERIFICATION_MESSAGES,
  codeSchema,
  issueCode,
  sendVerificationCode,
  verifyCode,
} from "@/domains/verification";
import { createPaymentIntent, type CreatedIntent } from "@/domains/payment";
import { confirmPaymentForFlow } from "./confirmPayment";

/**
 * What every action returns: a discriminated union, so the caller has to look
 * at `ok` before reaching for anything else. `data` is always present on
 * success — `void` for the actions that only report whether they worked.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const DONE: ActionResult<void> = { ok: true, data: undefined };

async function identify(): Promise<string> {
  return clientIdentifierFrom(await headers());
}

/* ---- Step 1 — player details -------------------------------------------- */

/**
 * Open (or re-open) a draft, then send the verification code.
 *
 * Re-entrant on purpose: a customer who goes back from step 2 to fix a typo
 * updates the same row rather than leaving a litter of drafts behind. Editing
 * the details clears any previous verification, so a changed email address must
 * be proven again.
 */
export async function startSubmissionAction(
  raw: unknown,
): Promise<ActionResult<{ email: string }>> {
  const limit = rateLimit(`start:${await identify()}`, {
    limit: 10,
    windowSeconds: 60 * 10,
  });
  if (!limit.ok) return fail("Too many attempts. Please wait a few minutes.");

  const parsed = parseSubmissionInput(raw);
  if (!parsed.ok) return fail(parsed.error);

  const existingId = await readFlowSession();
  const existing = existingId ? await getSubmission(existingId) : null;

  // A paid submission is finished; starting again means starting a new one.
  const reusable = existing && !isPaid(existing) ? existing : null;

  const submission = reusable
    ? await updateDraftDetails(reusable.id, parsed.value)
    : await createSubmission(parsed.value);

  await setFlowSession(submission.id);

  const sent = await sendCode(submission.id, submission.customerEmail);
  if (!sent) return fail("We couldn't send your code. Please try again.");

  return { ok: true, data: { email: submission.customerEmail } };
}

/* ---- Step 2 — email verification ---------------------------------------- */

async function sendCode(submissionId: string, email: string): Promise<boolean> {
  const code = await issueCode(submissionId);
  if (!code) return false;
  await sendVerificationCode(email, code);
  return true;
}

export async function resendCodeAction(): Promise<ActionResult> {
  const limit = rateLimit(`resend:${await identify()}`, {
    limit: 5,
    windowSeconds: 60 * 10,
  });
  if (!limit.ok) {
    return fail("Too many code requests. Please wait a few minutes.");
  }

  const submissionId = await readFlowSession();
  if (!submissionId) return fail("Your session has expired. Please start again.");

  const submission = await getSubmission(submissionId);
  if (!submission) return fail("Your session has expired. Please start again.");
  if (isPaid(submission)) return fail("This submission is already complete.");

  const sent = await sendCode(submission.id, submission.customerEmail);
  return sent ? DONE : fail("We couldn't send your code. Please try again.");
}

export async function verifyCodeAction(rawCode: string): Promise<ActionResult> {
  const limit = rateLimit(`verify:${await identify()}`, {
    limit: 20,
    windowSeconds: 60 * 10,
  });
  if (!limit.ok) return fail("Too many attempts. Please wait a few minutes.");

  const parsed = codeSchema.safeParse(rawCode);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Enter the code from your email.");
  }

  const submissionId = await readFlowSession();
  if (!submissionId) return fail("Your session has expired. Please start again.");

  const result = await verifyCode(submissionId, parsed.data);
  return result.ok ? DONE : fail(VERIFICATION_MESSAGES[result.reason]);
}

/* ---- Step 3 — the file list --------------------------------------------- */

/**
 * The files currently attached, so the panel can rebuild itself after a reload
 * instead of pretending nothing was uploaded.
 */
export async function listFlowFilesAction(): Promise<
  ActionResult<SubmissionFile[]>
> {
  const submissionId = await readFlowSession();
  if (!submissionId) return fail("Your session has expired. Please start again.");
  return { ok: true, data: await listSubmissionFiles(submissionId) };
}

/* ---- Step 4 — payment ---------------------------------------------------- */

/**
 * Mint the PaymentIntent for this submission.
 *
 * Refuses if nothing has been uploaded: paying for an empty submission is a
 * dead end for the customer and a support ticket for Yuta.
 */
export async function createIntentAction(): Promise<ActionResult<CreatedIntent>> {
  const submissionId = await readFlowSession();
  if (!submissionId) return fail("Your session has expired. Please start again.");

  const submission = await getSubmission(submissionId);
  if (!submission) return fail("Your session has expired. Please start again.");
  if (!submission.emailVerifiedAt) return fail("Please verify your email first.");
  if (isPaid(submission)) return fail("This submission has already been paid for.");

  const files = await listSubmissionFiles(submission.id);
  if (files.length === 0) return fail("Please attach at least one file first.");

  try {
    return { ok: true, data: await createPaymentIntent(submission) };
  } catch (err) {
    console.error("[checkout] intent creation failed:", err);
    return fail("We couldn't start the payment. Please try again.");
  }
}

/**
 * Close the loop after Stripe says the card cleared inline.
 *
 * The redirect path (3-D Secure, wallets) lands on `/api/payment/return`
 * instead; both call the same `confirmPaymentForFlow`.
 */
export async function confirmPaymentAction(
  paymentIntentId: string,
): Promise<ActionResult> {
  const outcome = await confirmPaymentForFlow(paymentIntentId);
  return outcome.ok ? DONE : fail(outcome.error);
}

/**
 * Let go of a finished submission so `/start` offers a fresh one.
 *
 * The flow cookie deliberately survives payment — it's what lets the
 * confirmation screen still name the player and count the files after a
 * redirect. This is the customer saying they're done looking at it.
 */
export async function startAnotherAction(): Promise<ActionResult> {
  await clearFlowSession();
  return DONE;
}
