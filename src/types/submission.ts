/**
 * The submission domain model — the vocabulary the whole app speaks.
 *
 * Deliberately knows nothing about Airtable. Column names, linked records, and
 * every other storage concern live in `src/integrations/airtable/schema.ts`,
 * which is the only file allowed to translate between the two. If storage ever
 * moves off Airtable, this file doesn't change.
 *
 * One name per concept: a property here is spelled the same way in the form,
 * the API, and the UI. See CLAUDE.md §0.
 */

/** What the player wants coached. Values are stable — they're stored in Airtable. */
export const FOCUS_OPTIONS = [
  "Hitting",
  "Pitching",
  "Fielding",
  "Catching",
  "Other",
] as const;

export type Focus = (typeof FOCUS_OPTIONS)[number];

/**
 * Submission lifecycle, in order. Mirrored as a single-select in Airtable, so
 * these strings are load-bearing — changing one is a data migration.
 *
 * The app only ever sets the first two. `Assigned` and `In Review` are Yuta's
 * to set as he works the queue; `Complete` is what triggers the feedback email.
 */
export const SUBMISSION_STATUSES = [
  "Awaiting Upload", // Paid, video not yet uploaded
  "New", // Video uploaded, needs a coach
  "Assigned", // Coach assigned, not yet started
  "In Review", // Coach is working on feedback
  "Complete", // Feedback delivered
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Statuses the app itself writes. Everything else is set by hand in Airtable. */
export type AppWrittenStatus = Extract<
  SubmissionStatus,
  "Awaiting Upload" | "New"
>;

/**
 * A submission, as the app sees it.
 *
 * `id` is the Airtable record ID — the app's handle on the row, and what
 * travels as the Mux `passthrough` (see ADR 002). `submissionId` is the
 * human-facing autonumber Yuta and customers can quote at each other.
 *
 * Everything optional is genuinely optional: Airtable omits empty fields
 * entirely, so absence is the normal case, not an error.
 */
export interface Submission {
  id: string;
  submissionId?: number;

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

  // Payment. Holds a Checkout Session ID today; becomes a PaymentIntent ID
  // when the Elements rebuild lands (ADR 005). One column either way — the
  // name describes the role, not the Stripe object.
  stripePaymentId?: string;
  stripeAmount?: number;

  // Video
  muxUploadId?: string;
  muxAssetId?: string;
  muxPlaybackId?: string;

  // Outcome
  assignedCoach?: string;
  feedbackVideoUrl?: string;
  feedbackEmailedAt?: string;
}

/** Fields the app is allowed to write. The rest are Airtable's or Yuta's. */
export type SubmissionPatch = Partial<
  Omit<Submission, "id" | "submissionId" | "submittedAt" | "assignedCoach">
>;

/** Streaming URL for an uploaded video, or null if it isn't ready yet. */
export function playbackUrl(submission: Submission): string | null {
  if (!submission.muxPlaybackId) return null;
  return `https://stream.mux.com/${submission.muxPlaybackId}.m3u8`;
}
