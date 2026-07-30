/**
 * The projection of a Submission that is safe to hand to anyone.
 *
 * The status lookup identifies customers by an **unverified** email, so anyone
 * who guesses an address sees whatever this type exposes. Internal fields —
 * Stripe id, amount, internal notes, the assigned coach, storage locators — are
 * deliberately absent. `id` is exposed only so the customer can hit the feedback
 * download route for their own submission.
 *
 * **Adding a field here is a security decision**, not a convenience one.
 */
import type { Submission, SubmissionStatus } from "./submission";

export interface PublicSubmission {
  id: string;
  playerName: string;
  focus?: string;
  status: SubmissionStatus;
  submittedAt?: string;
  /** Whether a downloadable feedback file is ready for the customer. */
  hasFeedback: boolean;
}

export function toPublicSubmission(submission: Submission): PublicSubmission {
  return {
    id: submission.id,
    playerName: submission.playerName || "Player",
    focus: submission.focus,
    status: submission.status,
    submittedAt: submission.submittedAt,
    // The feedback is only theirs to see once the review is finished.
    hasFeedback: submission.status === "complete" && !!submission.feedbackUrl,
  };
}
