/**
 * The ONLY file in this codebase that knows Airtable's column names.
 *
 * Every other file speaks the domain vocabulary in `src/types/submission.ts`.
 * If a column is renamed in the base, this file changes and nothing else does.
 * If you find yourself typing a quoted column name anywhere else, stop — that's
 * the drift this file exists to prevent (CLAUDE.md §0).
 *
 * Column names here must match the client's base exactly, including case.
 * See OPERATIONS.md §4 for the authoritative schema.
 */
import type { AirtableRecord } from "@/shared/airtable";
import {
  FOCUS_OPTIONS,
  SUBMISSION_STATUSES,
  type Focus,
  type Submission,
  type SubmissionPatch,
  type SubmissionStatus,
} from "../model/submission";

/** Domain property → Airtable column. The single source of truth for names. */
export const COLUMN = {
  submissionId: "Submission ID",
  customerEmail: "Customer Email",
  playerName: "Player Name",
  playerAge: "Player Age",
  focus: "Focus",
  customerNotes: "Customer Notes",
  internalNotes: "Internal Notes",
  status: "Status",
  submittedAt: "Submitted At",
  stripePaymentId: "Stripe Payment ID",
  stripeAmount: "Stripe Amount",
  muxUploadId: "Mux Upload ID",
  muxAssetId: "Mux Asset ID",
  muxPlaybackId: "Mux Playback ID",
  assignedCoach: "Assigned Coach",
  feedbackVideoUrl: "Feedback Video URL",
  feedbackEmailedAt: "Feedback Emailed At",
} as const satisfies Record<string, string>;

/**
 * Columns the app must never write.
 *
 * `Submission ID` and `Submitted At` are computed by Airtable (autonumber and
 * created-time) and rejected on write. `Assigned Coach` is Yuta's to set — the
 * app reads it to show the customer who reviewed their video, and would only
 * ever clobber it.
 */
const READ_ONLY = new Set<keyof typeof COLUMN>([
  "submissionId",
  "submittedAt",
  "assignedCoach",
]);

/**
 * Domain patch → Airtable field payload.
 *
 * Drops read-only columns and undefined values, so callers can pass a partial
 * without worrying about clobbering. Airtable treats an explicit `null` as
 * "clear this cell", which we never want implicitly.
 */
export function toAirtableFields(
  patch: SubmissionPatch,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    const property = key as keyof typeof COLUMN;
    if (value === undefined) continue;
    if (READ_ONLY.has(property)) continue;

    const column = COLUMN[property];
    if (!column) continue;

    fields[column] = value;
  }

  return fields;
}

/**
 * Airtable record → domain object.
 *
 * Every field is treated as possibly absent: Airtable omits empty cells
 * entirely rather than returning null, so `undefined` is the normal case.
 * Unrecognised status and focus values are dropped rather than trusted — a
 * typo'd single-select option in the base shouldn't become a bad type at
 * runtime.
 */
export function fromAirtableRecord(record: AirtableRecord): Submission {
  const f = record.fields;

  return {
    id: record.id,
    submissionId: asNumber(f[COLUMN.submissionId]),

    customerEmail: asString(f[COLUMN.customerEmail]) ?? "",
    playerName: asString(f[COLUMN.playerName]) ?? "",
    playerAge: asNumber(f[COLUMN.playerAge]),
    focus: asFocus(f[COLUMN.focus]),

    customerNotes: asString(f[COLUMN.customerNotes]),
    internalNotes: asString(f[COLUMN.internalNotes]),

    status: asStatus(f[COLUMN.status]) ?? "Awaiting Upload",
    submittedAt: asString(f[COLUMN.submittedAt]),

    stripePaymentId: asString(f[COLUMN.stripePaymentId]),
    stripeAmount: asNumber(f[COLUMN.stripeAmount]),

    muxUploadId: asString(f[COLUMN.muxUploadId]),
    muxAssetId: asString(f[COLUMN.muxAssetId]),
    muxPlaybackId: asString(f[COLUMN.muxPlaybackId]),

    assignedCoach: asString(f[COLUMN.assignedCoach]),
    feedbackVideoUrl: asString(f[COLUMN.feedbackVideoUrl]),
    feedbackEmailedAt: asString(f[COLUMN.feedbackEmailedAt]),
  };
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function asStatus(value: unknown): SubmissionStatus | undefined {
  if (typeof value !== "string") return undefined;
  return (SUBMISSION_STATUSES as readonly string[]).includes(value)
    ? (value as SubmissionStatus)
    : undefined;
}

function asFocus(value: unknown): Focus | undefined {
  if (typeof value !== "string") return undefined;
  return (FOCUS_OPTIONS as readonly string[]).includes(value)
    ? (value as Focus)
    : undefined;
}
