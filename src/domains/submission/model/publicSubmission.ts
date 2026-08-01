/**
 * The projection of a Submission that is safe to hand to anyone.
 *
 * The status lookup identifies customers by an **unverified** email, so anyone
 * who guesses an address sees whatever this type exposes. Internal fields —
 * Stripe id, amount, internal notes, the assigned coach, storage locators — are
 * deliberately absent. `id` and the feedback-file ids are exposed only so the
 * customer can hit the download routes for their own submission.
 *
 * **Adding a field here is a security decision**, not a convenience one.
 */
import type { Submission, SubmissionStatus } from "./submission";
import type { SubmissionFile } from "./submissionFile";

/** One downloadable feedback file, as the customer sees it — id and name only. */
export interface PublicFeedbackFile {
  id: string;
  filename: string;
}

export interface PublicSubmission {
  id: string;
  playerName: string;
  focus?: string;
  status: SubmissionStatus;
  submittedAt?: string;
  /**
   * The coach's response files, ready to download. Empty until the review is
   * `complete` — the feedback is only theirs to see once it's finished.
   */
  feedbackFiles: PublicFeedbackFile[];
}

export function toPublicSubmission(
  submission: Submission,
  feedbackFiles: SubmissionFile[] = [],
): PublicSubmission {
  return {
    id: submission.id,
    playerName: submission.playerName || "Player",
    focus: submission.focus,
    status: submission.status,
    submittedAt: submission.submittedAt,
    feedbackFiles:
      submission.status === "complete"
        ? feedbackFiles
            .filter((file) => !!file.fileUrl)
            .map((file) => ({ id: file.id, filename: file.filename }))
        : [],
  };
}
