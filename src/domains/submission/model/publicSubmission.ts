/**
 * The projection of a Submission that is safe to hand to anyone.
 *
 * The status lookup identifies customers by an **unverified** email, so anyone
 * who guesses an address sees whatever this type exposes. Internal fields —
 * Stripe id, amount, internal notes, the assigned coach, storage locators — are
 * deliberately absent.
 *
 * **The feedback files themselves are absent on purpose.** They used to be listed
 * here as download links, which meant guessing an email was enough to collect a
 * stranger's review. Delivery now rides on the unguessable signed link in the
 * customer's email (`/feedback/<token>`), not on this lookup — so this type only
 * reports *that* feedback is ready, never how to fetch it.
 *
 * **Adding a field here is a security decision**, not a convenience one.
 */
import type { Submission, SubmissionStatus } from "./submission";

export interface PublicSubmission {
  playerName: string;
  focus?: string;
  status: SubmissionStatus;
  submittedAt?: string;
  /**
   * Whether the review is finished. The customer downloads it from the link in
   * their email — never from here — so this is a flag, not a location.
   */
  hasFeedback: boolean;
}

export function toPublicSubmission(submission: Submission): PublicSubmission {
  return {
    playerName: submission.playerName || "Player",
    focus: submission.focus,
    status: submission.status,
    submittedAt: submission.submittedAt,
    hasFeedback: submission.status === "complete",
  };
}
