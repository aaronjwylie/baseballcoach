/**
 * The Airtable table this domain expects — column names *and* their types.
 *
 * `submissionSchema.ts` owns the names and the read/write codec; this owns the
 * **shape of the table itself**, so `scripts/airtable-schema.ts` can create it,
 * migrate it, and verify a live base against it.
 *
 * Two duplications die here:
 *
 * - The select choices are **derived** from `FOCUS_OPTIONS` and
 *   `SUBMISSION_STATUSES`, so Airtable's dropdowns cannot drift from the
 *   TypeScript unions. Add a status in one place and the migration adds it to
 *   the base.
 * - OPERATIONS.md §4's table is now *documentation of this spec* rather than a
 *   second, hand-maintained description of it.
 *
 * Nothing at runtime imports this — only the schema script — so it costs the
 * app bundle nothing.
 */
import { FOCUS_OPTIONS, SUBMISSION_STATUSES } from "../model/submission";
import { COLUMN } from "./submissionSchema";

/**
 * Airtable field types we use, as the Meta API spells them.
 * (Airtable's own names — `multilineText` for long text, and so on.)
 */
export type AirtableFieldType =
  | "autoNumber"
  | "singleLineText"
  | "multilineText"
  | "number"
  | "singleSelect"
  | "createdTime"
  | "currency"
  | "url"
  | "dateTime"
  | "checkbox";

export interface FieldSpec {
  /** The column name — always from COLUMN, never a literal. */
  name: string;
  type: AirtableFieldType;
  /** Passed through to the Meta API verbatim when present. */
  options?: Record<string, unknown>;
  /** Written into Airtable as the field description, so Yuta sees it too. */
  description: string;
  /** True when Airtable computes it and the app is blocked from writing it. */
  computed?: boolean;
}

const selectChoices = (values: readonly string[]) => ({
  choices: values.map((name) => ({ name })),
});

/**
 * The table, in the order the columns should appear.
 *
 * The **first entry becomes the primary field**. `Submission ID` leads because
 * a human-quotable reference is what Yuta and a customer need to talk about the
 * same submission.
 */
export const SUBMISSION_FIELDS: readonly FieldSpec[] = [
  {
    name: COLUMN.submissionId,
    type: "autoNumber",
    description: "Human-readable reference. Airtable assigns it; the app never writes it.",
    computed: true,
  },
  {
    name: COLUMN.customerEmail,
    type: "singleLineText",
    description: "Who paid. Always lowercased — the status lookup matches on it.",
  },
  {
    name: COLUMN.playerName,
    type: "singleLineText",
    description: "The player whose video this is.",
  },
  {
    name: COLUMN.playerAge,
    type: "number",
    options: { precision: 0 },
    description: "Whole years. Optional.",
  },
  {
    name: COLUMN.focus,
    type: "singleSelect",
    options: selectChoices(FOCUS_OPTIONS),
    description: "What the customer wants coached. Drives which coach you assign.",
  },
  {
    name: COLUMN.customerNotes,
    type: "multilineText",
    description: "The customer's own words. DON'T EDIT — this is what you forward to a coach.",
  },
  {
    name: COLUMN.internalNotes,
    type: "multilineText",
    description: "Yours, plus [system] messages from the app. Safe to edit.",
  },
  {
    name: COLUMN.status,
    type: "singleSelect",
    options: selectChoices(SUBMISSION_STATUSES),
    description:
      "The app sets Awaiting Upload and New. The rest are yours; Complete sends the feedback email.",
  },
  {
    name: COLUMN.submittedAt,
    type: "createdTime",
    description: "When the row was created. Airtable computes it; can't be edited.",
    computed: true,
  },
  {
    name: COLUMN.stripePaymentId,
    type: "singleLineText",
    description: "Stripe's id for the payment. DON'T EDIT — the app finds rows by it.",
  },
  {
    name: COLUMN.stripeAmount,
    type: "currency",
    options: { precision: 2, symbol: "$" },
    description: "What they paid, in CAD.",
  },
  {
    name: COLUMN.muxUploadId,
    type: "singleLineText",
    description: "Mux upload reference. DON'T EDIT.",
  },
  {
    name: COLUMN.muxAssetId,
    type: "singleLineText",
    description: "Mux asset reference. DON'T EDIT.",
  },
  {
    name: COLUMN.muxPlaybackId,
    type: "singleLineText",
    description:
      "Watch the video at https://stream.mux.com/<this>.m3u8 — that's the link you send a coach.",
  },
  {
    name: COLUMN.assignedCoach,
    type: "singleLineText",
    description: "Type the coach's name. Yours alone — the app only reads it.",
  },
  {
    name: COLUMN.feedbackVideoUrl,
    type: "url",
    description:
      "The coach's Loom link. Paste it here, THEN set Status to Complete — Complete without a link sends nothing.",
  },
  {
    name: COLUMN.feedbackEmailedAt,
    type: "dateTime",
    options: {
      dateFormat: { name: "iso" },
      timeFormat: { name: "24hour" },
      timeZone: "utc",
    },
    description: "Stamped by the app when the feedback email goes out. Its presence prevents a second send.",
  },
];

/**
 * Renames from the pre-Step-1 schema. Applied by `--migrate`.
 *
 * Renaming in Airtable **preserves the data**, which is what makes the
 * migration safe. Type changes are a different story — see the script.
 */
export const LEGACY_RENAMES: readonly { from: string; to: string }[] = [
  { from: "Email", to: COLUMN.customerEmail },
  { from: "Sport", to: COLUMN.focus },
  { from: "Stripe Session ID", to: COLUMN.stripePaymentId },
  { from: "Feedback Link", to: COLUMN.feedbackVideoUrl },
  { from: "Notes", to: COLUMN.customerNotes },
];

/** Columns the old schema had and the new one doesn't. Delete by hand, last. */
export const LEGACY_RETIRED: readonly string[] = [
  "Created At",
  "Feedback Emailed",
];
