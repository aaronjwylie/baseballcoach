/**
 * The trail's vocabulary — what kinds of thing get recorded, and how far a send
 * got.
 *
 * The two lists lived as bare unions in `api/submissionEventApi.ts`, spelled a
 * second time as pgEnums. A vocabulary isn't an API concern: it's what the
 * domain *says*, and the API is one of the things that says it.
 */

/**
 * What kind of thing an entry in the trail records.
 *
 * The trail began as status transitions only, which left the one class of event
 * that **fails silently** — a send — invisible. `sendEmail` reports its outcome
 * and nothing was writing it down, so a progress view could only say "the status
 * implies we tried", never "it landed".
 *
 * `verification` closes the same gap on the customer's side. Entering the code
 * is the one thing they *do* between a send and a status move, and it was
 * visible only as its side effect — the rung advancing. A **failed** attempt
 * left no trace at all, which is the half that matters: four wrong guesses and
 * a customer who never received the code look identical from the outside, and
 * they call for opposite responses.
 */
export const SUBMISSION_EVENT_KINDS = [
  "status",
  "email",
  "verification",
] as const;

export type SubmissionEventKind = (typeof SUBMISSION_EVENT_KINDS)[number];

/**
 * How far an email got.
 *
 * `sent` is all the send path can honestly claim — Resend accepted it. The rest
 * arrives later, by webhook, and is the difference between "we tried" and "it
 * reached them". A `bounced` on the verification code is the failure that used
 * to look exactly like a customer being slow.
 *
 * **Outcomes append, they never update.** Overwriting "we sent it" with "it
 * bounced" loses that both were true and when — and a delivery three seconds
 * later reads very differently from one three minutes later.
 */
export const EMAIL_OUTCOMES = [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "failed",
] as const;

export type EmailOutcome = (typeof EMAIL_OUTCOMES)[number];
