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
export const FOCUS_OPTIONS = [
  "Hitting",
  "Pitching",
  "Fielding",
  "Catching",
  "Other",
] as const;

export type Focus = (typeof FOCUS_OPTIONS)[number];

/**
 * Submission lifecycle, in order. Matches the `submission_status` enum.
 *
 * The customer flow writes the first three:
 *
 * | status             | reached when                                   |
 * | ------------------ | ---------------------------------------------- |
 * | `draft`            | step 1 — they gave us player details            |
 * | `awaiting_payment` | step 2 — their email is verified; files may land |
 * | `new`              | step 4 — the payment cleared                    |
 *
 * The admin drives `assigned` / `in_review` from the portal; a coach marking
 * their work done sets `complete`, which fires the feedback email.
 *
 * There is no "paid but no file yet" state any more — files arrive before
 * payment, so `awaiting_upload` was retired with the flow that needed it.
 */
export const SUBMISSION_STATUSES = [
  "draft",
  "awaiting_payment",
  "new",
  "assigned",
  "in_review",
  "awaiting_approval",
  "complete",
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
  new: true,
  assigned: true,
  in_review: true,
  awaiting_approval: true,
  complete: true,
};

export const PAID_STATUSES: readonly SubmissionStatus[] =
  SUBMISSION_STATUSES.filter((status) => PAID_AT_STATUS[status]);

export function isPaid(submission: Pick<Submission, "status">): boolean {
  return PAID_AT_STATUS[submission.status];
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

  // When the retention sweep deleted the customer's uploaded bytes
  filesPurgedAt?: string;

  // Coaching
  assignedCoachId?: string;
  feedbackEmailedAt?: string;
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
