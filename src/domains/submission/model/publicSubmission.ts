/**
 * The projection of a Submission that is safe to hand to anyone.
 *
 * The status lookup identifies customers by an **unverified** email address, so
 * anyone who guesses an address sees whatever this type exposes. Internal
 * fields — Stripe and Mux ids, internal notes, the amount paid, the assigned
 * coach — are deliberately absent.
 *
 * **Adding a field here is a security decision**, not a convenience one. That
 * is why this lives in the domain beside the record it trims, rather than in
 * the route that happens to serialize it.
 */
import type { Submission, SubmissionStatus } from "./submission";

export interface PublicSubmission {
  submissionId?: number;
  playerName: string;
  focus?: string;
  status: SubmissionStatus;
  submittedAt?: string;
  feedbackVideoUrl?: string;
}

export function toPublicSubmission(submission: Submission): PublicSubmission {
  return {
    submissionId: submission.submissionId,
    playerName: submission.playerName || "Player",
    focus: submission.focus,
    status: submission.status,
    submittedAt: submission.submittedAt,
    // The feedback link is only theirs to see once the review is finished.
    feedbackVideoUrl:
      submission.status === "Complete"
        ? submission.feedbackVideoUrl
        : undefined,
  };
}
