/**
 * The submission domain model — the vocabulary the whole app speaks.
 *
 * Knows nothing about storage. The Postgres column names live in the Drizzle
 * schema (`shared/db`); the row↔domain mapping lives in `api/submissionRow.ts`.
 * If storage ever moves, this file doesn't change.
 *
 * One name per concept: a property here is spelled the same way in the form,
 * the API, and the UI.
 *
 * **A submission carries a pack of files, not one video.** Its uploads are rows
 * in `submissionFiles` (see `./submissionFile.ts`); nothing here holds a single
 * locator, and phrasing anything as "the video" is how the old one-column model
 * crept back in.
 */

/** What the player wants coached. Matches the `focus` enum in the DB. */
import type { FileSet } from "./submissionFile";

export const FOCUS_OPTIONS = [
  "Hitting",
  "Pitching",
  "Fielding",
  "Catching",
  "Other",
] as const;

export type Focus = (typeof FOCUS_OPTIONS)[number];

/**
 * The submission lifecycle — **the ladder**. Sixteen rungs, in order.
 *
 * Every meaningful transition has a status, and every status is stamped in
 * `submission_events`. The canonical account of what each one means, who moves
 * it, and which email fires is
 * [`_SubmissionDocumentation.md` §2](../_SubmissionDocumentation.md).
 *
 * **It is a path with branches, not a progress bar.** Four rungs are only
 * touched when a submission needs translating; a coach who reads English takes
 * `assigned → sent_to_coach` and `awaiting_approval → complete` directly.
 * Anything rendering this as a linear track will be wrong for most submissions.
 *
 * The vocabulary is **intake / response** — what the customer sent, what the
 * coach wrote (`_NomenclatureLaw.md` §3). Statuses are **participles** (what has
 * happened); the matching file kinds are **nouns** (what a file is), so
 * `intake_translated` the status never reads as `intake_translation` the kind.
 *
 * | rung | reached when |
 * | --- | --- |
 * | `draft` | step 1 — player details captured |
 * | `awaiting_payment` | step 2 — the email is proven; uploads may begin |
 * | `new` | step 4 — **the payment cleared.** The boundary |
 * | `assigned` | step 5 — a coach is chosen, and translation need becomes derivable |
 * | `intake_translating` | step 6 — the customer's files have gone out for translation |
 * | `intake_translated` | step 7 — the translated set is back and stored |
 * | `sent_to_coach` | step 8 — emailed with the chosen language set, not yet picked up |
 * | `in_review` | step 9 — **the coach actually has the files** |
 * | `awaiting_approval` | step 10 — a response exists; the customer can't see it |
 * | `response_translating` | step 11 — the response has gone out for translation |
 * | `response_translated` | step 12 — the translated version is back and stored |
 * | `complete` | step 13 — released to the customer |
 * | `collected` | step 14 — **the customer downloaded it.** The retention clock starts |
 * | `resolved` | step 15 — Yuta closed it; the thank-you has gone |
 * | `purge_imminent` | step 16 — deletion is a week out; the customer has been warned |
 * | `purged` | step 17 — the bytes are gone; the record is permanent |
 */
export const SUBMISSION_STATUSES = [
  "draft",
  "awaiting_payment",
  "new",
  "assigned",
  "intake_translating",
  "intake_translated",
  "sent_to_coach",
  "in_review",
  "awaiting_approval",
  "response_translating",
  "response_translated",
  "complete",
  "collected",
  "resolved",
  "purge_imminent",
  "purged",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Statuses the customer-facing flow itself writes. */
export type AppWrittenStatus = Extract<
  SubmissionStatus,
  "draft" | "awaiting_payment" | "new"
>;

/** Statuses that mean money has changed hands. */
/**
 * Has money changed hands by this point?
 *
 * **A Record, not a list, deliberately** — adding a status to
 * `SUBMISSION_STATUSES` without answering this question is now a compile error.
 *
 * It was a list, and that cost us: `awaiting_approval` was added to the
 * lifecycle without being added here, which silently meant a *paid* submission
 * sitting on Yuta's desk read as unpaid. Six call sites believe `isPaid`, and
 * two of them act destructively on a `false` — `discardUnpaidSubmission` would
 * have deleted it outright, and `markSubmissionPaid` would have treated a
 * redelivered Stripe webhook as a fresh payment, walking the status backwards
 * over the coach's work and sending a second receipt. Nothing failed loudly;
 * the list just quietly stopped being complete.
 */
const PAID_AT_STATUS: Record<SubmissionStatus, boolean> = {
  draft: false,
  awaiting_payment: false,
  // Everything from `new` onward has been paid for. The ladder only branches
  // after step 4, so every rung added since is trivially true — but the Record
  // makes answering mandatory rather than assumed.
  new: true,
  assigned: true,
  intake_translating: true,
  intake_translated: true,
  sent_to_coach: true,
  in_review: true,
  awaiting_approval: true,
  response_translating: true,
  response_translated: true,
  complete: true,
  collected: true,
  resolved: true,
  purge_imminent: true,
  purged: true,
};

export const PAID_STATUSES: readonly SubmissionStatus[] =
  SUBMISSION_STATUSES.filter((status) => PAID_AT_STATUS[status]);

export function isPaid(submission: Pick<Submission, "status">): boolean {
  return PAID_AT_STATUS[submission.status];
}

/**
 * Does a coach's response exist yet?
 *
 * True from `awaiting_approval` — the coach has delivered — even though the
 * customer can't see it until Yuta releases it. That gap is the whole point of
 * the approval gate, so "a response exists" and "the customer may have it" are
 * two different questions with two different predicates.
 */
const HAS_RESPONSE_AT_STATUS: Record<SubmissionStatus, boolean> = {
  draft: false,
  awaiting_payment: false,
  new: false,
  assigned: false,
  intake_translating: false,
  intake_translated: false,
  sent_to_coach: false,
  in_review: false,
  awaiting_approval: true,
  response_translating: true,
  response_translated: true,
  complete: true,
  collected: true,
  resolved: true,
  purge_imminent: true,
  purged: true,
};

export function hasResponse(submission: Pick<Submission, "status">): boolean {
  return HAS_RESPONSE_AT_STATUS[submission.status];
}

/**
 * May the customer see the response?
 *
 * True from `complete` onward — step 13 is the moment it reaches them, and
 * nothing later takes that back. **This is what `status === "complete"` used to
 * mean**, and the reason it can no longer be written that way: a customer who
 * downloads moves the submission to `collected`, and a literal comparison would
 * have silently revoked their own access the instant they used it.
 *
 * Released is about *permission*, not availability. A `purged` submission is
 * still released; its files are simply gone, which `/api/files/[id]` answers
 * with 410 rather than 404 — "you may have this, but it no longer exists" is a
 * different sentence from "this was never yours".
 */
const RELEASED_AT_STATUS: Record<SubmissionStatus, boolean> = {
  draft: false,
  awaiting_payment: false,
  new: false,
  assigned: false,
  intake_translating: false,
  intake_translated: false,
  sent_to_coach: false,
  in_review: false,
  awaiting_approval: false,
  response_translating: false,
  response_translated: false,
  complete: true,
  collected: true,
  resolved: true,
  purge_imminent: true,
  purged: true,
};

export function isReleased(submission: Pick<Submission, "status">): boolean {
  return RELEASED_AT_STATUS[submission.status];
}

/**
 * Is this on a coach's desk — theirs to act on?
 *
 * `assigned` is included because Yuta may assign before emailing, and the coach
 * seeing it early is harmless. It stops at `awaiting_approval`: once they've
 * delivered, the work is Yuta's.
 */
const WITH_COACH_AT_STATUS: Record<SubmissionStatus, boolean> = {
  draft: false,
  awaiting_payment: false,
  new: false,
  assigned: true,
  // Translation happens between assignment and hand-off; the coach has nothing
  // to do yet, but the row is legitimately theirs.
  intake_translating: true,
  intake_translated: true,
  sent_to_coach: true,
  in_review: true,
  awaiting_approval: false,
  response_translating: false,
  response_translated: false,
  complete: false,
  collected: false,
  resolved: false,
  purge_imminent: false,
  purged: false,
};

export function isWithCoach(submission: Pick<Submission, "status">): boolean {
  return WITH_COACH_AT_STATUS[submission.status];
}

/**
 * A submission, as the app sees it. `id` is the row's uuid — the app's handle
 * on it and the key every other domain links by. Optional fields are genuinely
 * optional (null in the DB → undefined here).
 */
export interface Submission {
  id: string;

  // Who
  customerEmail: string;
  playerName: string;
  playerAge?: number;
  focus?: Focus;

  // What they told us, and what we tell ourselves
  customerNotes?: string;
  internalNotes?: string;

  // Where it is
  status: SubmissionStatus;
  submittedAt?: string;
  completedAt?: string;
  // Set when an operator archives a completed submission — hides it from the
  // active queue ("All") and files it under the Archived view.
  archivedAt?: string;

  // Email verification — the gate on uploading, since payment comes later
  emailVerifiedAt?: string;

  // Payment (Stripe holds the money; we keep the id + amount in cents)
  stripePaymentId?: string;
  stripeAmount?: number;
  paidAt?: string;

  // The coach's response — a storage locator, served via /api/feedback/[id].
  // The customer's own uploads are rows in `submissionFiles`, not a field here.
  feedbackUrl?: string;
  /** What the coach was sent at step 8, and the customer at step 13. */
  coachFileSet?: FileSet;
  customerFileSet?: FileSet;

  // When the retention sweep deleted the customer's uploaded bytes
  filesPurgedAt?: string;

  // Coaching
  assignedCoachId?: string;
  feedbackEmailedAt?: string;
  /** First collection — the retention clock's anchor. */
  collectedAt?: string;
  deletionWarnedAt?: string;
}

/** Everything required to open a submission at step 1. */
export interface NewSubmission {
  customerEmail: string;
  playerName: string;
  playerAge?: number;
  focus?: Focus;
  customerNotes?: string;
  status?: SubmissionStatus;
  stripePaymentId?: string;
  stripeAmount?: number;
}

/** Fields the app may update on an existing submission. */
export type SubmissionPatch = Partial<Omit<Submission, "id" | "submittedAt">>;
