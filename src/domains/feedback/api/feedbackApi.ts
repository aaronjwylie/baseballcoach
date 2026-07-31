/**
 * Delivering feedback — a two-step hand-off.
 *
 * 1. `storeFeedback` (coach): save the file and move the submission to
 *    `awaiting_approval`. The customer is **not** emailed yet — Yuta reviews the
 *    coach's material first.
 * 2. `approveAndComplete` (admin): mark it `complete`, stamp `completedAt`, and
 *    email the customer their download link. Best-effort email ([ADR 004]) so a
 *    mail hiccup never blocks completion.
 */
import { storage, feedbackKey } from "@/shared/storage";
import {
  getSubmission,
  updateSubmission,
  type Submission,
} from "@/domains/submission";
import { env } from "@/shared/config/env";
import { sendFeedbackReady } from "./feedbackEmail";

/**
 * Coach uploads their breakdown. Stores the file and parks the submission at
 * `awaiting_approval` for Yuta — no customer email at this step.
 */
export async function storeFeedback(
  submissionId: string,
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<Submission> {
  const key = feedbackKey(submissionId, filename);
  const feedbackUrl = await storage.save(key, bytes, contentType);

  return updateSubmission(submissionId, {
    feedbackUrl,
    status: "awaiting_approval",
  });
}

/**
 * Yuta approves the coach's work: complete the submission and send the customer
 * their feedback. Only acts on a submission that's actually awaiting approval
 * and has a file, so a stray click can't email an empty review.
 */
export async function approveAndComplete(
  submissionId: string,
): Promise<Submission | null> {
  const submission = await getSubmission(submissionId);
  if (
    !submission ||
    submission.status !== "awaiting_approval" ||
    !submission.feedbackUrl
  ) {
    return null;
  }

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
    await sendFeedbackReady(
      updated.customerEmail,
      `${env.siteUrl}/api/feedback/${updated.id}`,
      updated.playerName,
    );
  }

  return updated;
}
