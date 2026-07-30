/**
 * The submission domain model — the vocabulary the whole app speaks.
 *
 * Knows nothing about storage. The Postgres column names live in the Drizzle
 * schema (`shared/db`); the row↔domain mapping lives in `api/submissionRow.ts`.
 * If storage ever moves, this file doesn't change.
 *
 * One name per concept: a property here is spelled the same way in the form,
 * the API, and the UI.
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
 * The app writes the first two — `awaiting_upload` on payment, `new` on upload
 * complete. The admin drives `assigned` / `in_review` from the portal; a coach
 * marking their work done sets `complete`, which fires the feedback email.
 */
export const SUBMISSION_STATUSES = [
  "awaiting_upload",
  "new",
  "assigned",
  "in_review",
  "complete",
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Statuses the customer-facing flow itself writes. */
export type AppWrittenStatus = Extract<SubmissionStatus, "awaiting_upload" | "new">;

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

  // Payment (Stripe holds the money; we keep the id + amount in cents)
  stripePaymentId?: string;
  stripeAmount?: number;

  // Files — storage locators (local key or Blob URL), served via /api routes
  videoUrl?: string;
  feedbackUrl?: string;

  // Coaching
  assignedCoachId?: string;
  feedbackEmailedAt?: string;
}

/** Everything required to create a submission at payment time. */
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
export type SubmissionPatch = Partial<
  Omit<Submission, "id" | "submittedAt">
>;
