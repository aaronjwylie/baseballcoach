/**
 * Delivering feedback — the coach's payoff verb.
 *
 * Save the coach's file to storage, mark the submission complete, and email the
 * customer their download link. The email is best-effort ([ADR 004]) so a mail
 * hiccup never blocks completion.
 */
import { storage, feedbackKey } from "@/shared/storage";
import { updateSubmission, type Submission } from "@/domains/submission";
import { env } from "@/shared/config/env";
import { sendFeedbackReady } from "./feedbackEmail";

export async function storeFeedbackAndComplete(
  submissionId: string,
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<Submission> {
  const key = feedbackKey(submissionId, filename);
  const feedbackUrl = await storage.save(key, bytes, contentType);

  const updated = await updateSubmission(submissionId, {
    feedbackUrl,
    status: "complete",
    feedbackEmailedAt: new Date().toISOString(),
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
