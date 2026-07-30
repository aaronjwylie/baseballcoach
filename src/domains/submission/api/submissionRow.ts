/**
 * The row↔domain mapping — the single seam between the `submissions` table and
 * the domain `Submission`. The Drizzle schema already uses the domain's
 * property names, so this is mostly null→undefined and Date→ISO string.
 *
 * No other file turns a DB row into a Submission.
 */
import type { SubmissionRow } from "@/shared/db";
import type { Submission } from "../model/submission";

export function fromRow(row: SubmissionRow): Submission {
  return {
    id: row.id,
    customerEmail: row.customerEmail,
    playerName: row.playerName,
    playerAge: row.playerAge ?? undefined,
    focus: row.focus ?? undefined,
    customerNotes: row.customerNotes ?? undefined,
    internalNotes: row.internalNotes ?? undefined,
    status: row.status,
    submittedAt: row.submittedAt?.toISOString(),
    stripePaymentId: row.stripePaymentId ?? undefined,
    stripeAmount: row.stripeAmount ?? undefined,
    videoUrl: row.videoUrl ?? undefined,
    feedbackUrl: row.feedbackUrl ?? undefined,
    assignedCoachId: row.assignedCoachId ?? undefined,
    feedbackEmailedAt: row.feedbackEmailedAt?.toISOString(),
  };
}
