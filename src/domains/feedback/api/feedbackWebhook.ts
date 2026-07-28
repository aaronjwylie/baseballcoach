/**
 * The inbound hook Airtable calls when Yuta marks a submission Complete.
 *
 * Unlike the Stripe and Mux webhooks there's no SDK signature to verify, so a
 * shared secret compared in constant time is the whole of this endpoint's
 * defence — hence it lives here, next to what it guards, rather than in a
 * general-purpose helper where it could drift out of use.
 */
import { timingSafeEqual } from "node:crypto";
import { getSubmission, updateSubmission } from "@/domains/submission";
import { env } from "@/shared/config/env";
import { sendFeedbackReady } from "./feedbackEmail";

/** Constant-time comparison of the shared secret the automation sends. */
export function isAuthorizedFeedbackWebhook(provided: string | null): boolean {
  const a = Buffer.from(provided ?? "");
  const b = Buffer.from(env.airtableWebhookSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type NotifyResult =
  | "sent"
  | "already-sent"
  | "not-ready"
  | "not-found";

/**
 * Email the customer their feedback link.
 *
 * The record is re-read rather than trusted from the payload — the automation
 * sends only an id, and everything the email needs is fetched fresh.
 *
 * Idempotent two ways: `feedbackEmailedAt` is checked before sending and
 * stamped after, and the Airtable trigger fires once per record. Either alone
 * would mostly work; both means a manually re-fired automation still can't
 * double-send.
 */
export async function notifyFeedbackReady(
  recordId: string,
): Promise<NotifyResult> {
  const submission = await getSubmission(recordId);
  if (!submission) return "not-found";

  // A Complete row with no link would produce an email with nowhere to go —
  // worse than no email at all.
  if (
    submission.status !== "Complete" ||
    !submission.feedbackVideoUrl ||
    !submission.customerEmail
  ) {
    return "not-ready";
  }

  if (submission.feedbackEmailedAt) return "already-sent";

  // Best-effort and never throws (ADR 004), so a mail failure can't trigger an
  // Airtable retry and risk a duplicate send.
  await sendFeedbackReady(
    submission.customerEmail,
    submission.feedbackVideoUrl,
    submission.playerName,
  );

  // Stamping is best-effort too. Failing loudly here would make Airtable retry
  // and re-send the email we just sent — the guard's failure mode must not be
  // worse than having no guard.
  try {
    await updateSubmission(submission.id, {
      feedbackEmailedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      "[feedback webhook] could not stamp Feedback Emailed At (add the column to make sends idempotent):",
      err,
    );
  }

  return "sent";
}
