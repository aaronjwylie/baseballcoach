/**
 * Delivering feedback — a two-step hand-off, now multi-file.
 *
 * A coach attaches **one or more** response files to a submission (each a row in
 * `submission_files` with `kind = "feedback"`), then hands the set to Yuta:
 *
 * 1. Files arrive one at a time — `saveFeedbackFile` (dev proxy) or
 *    `recordFeedbackFile` (prod direct-to-Blob). Attaching a file does **not**
 *    move the submission on its own.
 * 2. `sendFeedbackForApproval` (coach): with at least one file attached, park the
 *    submission at `awaiting_approval`. The customer is **not** emailed yet.
 * 3. `approveAndComplete` (admin): mark it `complete`, stamp `completedAt`, and
 *    email the customer that their feedback is ready. Best-effort email
 *    ([ADR 004]) so a mail hiccup never blocks completion.
 */
import { storage, feedbackFileKey } from "@/shared/storage";
import {
  addSubmissionFile,
  getSubmission,
  listFeedbackFiles,
  markCustomerCollected,
  updateSubmission,
  type Submission,
  type SubmissionFile,
} from "@/domains/submission";
import { getCoach } from "@/domains/coach";
import { listAdminEmails } from "@/domains/account";
import { env } from "@/shared/config/env";
import {
  sendCustomerCollectedEmail,
  sendFeedbackReady,
  sendResponseSubmittedEmail,
} from "./feedbackEmail";
import { signFeedbackToken } from "./feedbackToken";

/**
 * Save a feedback file the bytes of which came through us — the dev proxy path,
 * where there's no Blob store. Records a `feedback` row; leaves the status alone.
 */
export async function saveFeedbackFile(
  submissionId: string,
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<SubmissionFile> {
  const key = feedbackFileKey(submissionId, filename);
  const fileUrl = await storage.save(key, bytes, contentType);
  return addSubmissionFile(
    { submissionId, filename, contentType, sizeBytes: bytes.byteLength, fileUrl },
    "response",
  );
}

/**
 * Record a feedback file the browser uploaded straight to Blob — the prod path.
 * The object already landed; this only writes the `response` row.
 */
export async function recordFeedbackFile(
  submissionId: string,
  input: { filename: string; contentType: string; sizeBytes: number; fileUrl: string },
): Promise<SubmissionFile> {
  return addSubmissionFile({ submissionId, ...input }, "response");
}

/**
 * Coach hands their breakdown to Yuta. Requires at least one feedback file, so a
 * stray click can't park an empty review for approval. No customer email here.
 */
export async function sendFeedbackForApproval(
  submissionId: string,
): Promise<Submission | null> {
  const files = await listFeedbackFiles(submissionId);
  if (files.length === 0) return null;

  /*
    Only a submission actually in review can be delivered.

    The coach's ownership was already checked by the caller; the *status* wasn't,
    which meant a stale tab could deliver twice, or deliver work on a submission
    Yuta had already approved — walking it backwards over its own completion.
    Unreachable by clicking, which is exactly why it was worth closing.
  */
  const current = await getSubmission(submissionId);
  if (!current || current.status !== "in_review") return null;

  const updated = await updateSubmission(submissionId, {
    status: "awaiting_approval",
  });

  // ⑤ — tell Yuta it's waiting, and the coach that it arrived. Best-effort: the
  // work is delivered either way, and a webhook must never fail on mail.
  const coach = updated.assignedCoachId
    ? await getCoach(updated.assignedCoachId)
    : null;
  const admins = await listAdminEmails();
  await sendResponseSubmittedEmail({
    to: [...admins, ...(coach?.email ? [coach.email] : [])],
    coachName: coach?.name ?? "The coach",
    playerName: updated.playerName,
    fileCount: files.length,
    reviewUrl: `${env.siteUrl}/admin`,
  });

  return updated;
}

/**
 * The customer collected their feedback — stamp it, and tell Yuta.
 *
 * Called from every route that hands a response file over. **Idempotent**: only
 * the first collection moves the status, so a re-download can't restart the
 * retention clock or send a second notification.
 *
 * Deliberately not awaited on the download path's critical section — see the
 * routes. A notification must never be the reason a file fails to arrive.
 */
export async function noteCustomerCollected(
  submissionId: string,
): Promise<void> {
  const collected = await markCustomerCollected(submissionId);
  if (!collected) return;

  await sendCustomerCollectedEmail({
    to: await listAdminEmails(),
    playerName: collected.playerName,
    submissionUrl: `${env.siteUrl}/admin`,
  });
}

/**
 * Yuta approves the coach's work: complete the submission and tell the customer
 * their feedback is ready. Only acts on a submission that's actually awaiting
 * approval and has at least one feedback file, so a stray click can't email an
 * empty review.
 */
export async function approveAndComplete(
  submissionId: string,
): Promise<Submission | null> {
  const submission = await getSubmission(submissionId);
  if (!submission || submission.status !== "awaiting_approval") return null;

  const files = await listFeedbackFiles(submissionId);
  if (files.length === 0) return null;

  const now = new Date().toISOString();
  const updated = await updateSubmission(submissionId, {
    status: "complete",
    feedbackEmailedAt: now,
    // `completedAt` is what the retention sweep counts from. Setting the status
    // without it would leave the submission complete but immortal — its uploads
    // never due, because the clock never started.
    completedAt: now,
  });

  if (updated.customerEmail) {
    // An unguessable, signed capability link — not the email-lookup page, which
    // anyone who guessed an address could use to collect a stranger's feedback.
    // The link lands on a page that lists every file for this one submission.
    const token = await signFeedbackToken(updated.id);
    await sendFeedbackReady(
      updated.customerEmail,
      `${env.siteUrl}/feedback/${token}`,
      updated.playerName,
    );
  }

  return updated;
}
