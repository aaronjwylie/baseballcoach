/**
 * The row↔domain mapping — the single seam between the submission tables and
 * their domain types. The Drizzle schema already uses the domain's property
 * names, so this is mostly null→undefined and Date→ISO string.
 *
 * No other file turns a DB row into a `Submission` or a `SubmissionFile`.
 */
import type { SubmissionRow, SubmissionFileRow } from "@/shared/db";
import type { Submission } from "../model/submission";
import type { SubmissionFile } from "../model/submissionFile";

export function fromRow(row: SubmissionRow): Submission {
  return {
    id: row.id,
    customerEmail: row.customerEmail,
    playerName: row.playerName,
    playerAge: row.playerAge ?? undefined,
    focus: row.focus ?? undefined,
    customerNotes: row.customerNotes ?? undefined,
    languages: row.languages ?? undefined,
    internalNotes: row.internalNotes ?? undefined,
    status: row.status,
    submittedAt: row.submittedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    archivedAt: row.archivedAt?.toISOString(),
    emailVerifiedAt: row.emailVerifiedAt?.toISOString(),
    stripePaymentId: row.stripePaymentId ?? undefined,
    stripeAmount: row.stripeAmount ?? undefined,
    paidAt: row.paidAt?.toISOString(),
    feedbackUrl: row.feedbackUrl ?? undefined,
    coachFileSet: row.coachFileSet ?? undefined,
    customerFileSet: row.customerFileSet ?? undefined,
    filesPurgedAt: row.filesPurgedAt?.toISOString(),
    assignedCoachId: row.assignedCoachId ?? undefined,
    feedbackEmailedAt: row.feedbackEmailedAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
    collectedAt: row.collectedAt?.toISOString(),
    deletionWarnedAt: row.deletionWarnedAt?.toISOString(),
  };
}

export function fromFileRow(row: SubmissionFileRow): SubmissionFile {
  return {
    id: row.id,
    submissionId: row.submissionId,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    fileUrl: row.fileUrl ?? undefined,
    // The column is the `file_kind` enum, so the row already carries one of the
    // four values — no narrowing needed, and no default that could mask a
    // mismatch between the enum and the union.
    kind: row.kind,
    uploadedAt: row.uploadedAt?.toISOString(),
  };
}
