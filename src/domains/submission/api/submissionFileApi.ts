/**
 * Files attached to a submission — everything the app does to the
 * `submission_files` table.
 *
 * The table holds **four kinds** (the four folders), kept apart by the `kind`
 * column — `intake` and `intake_translation` for what the customer sent,
 * `response` and `response_translation` for what the coach wrote back. Every
 * read here is scoped to one side, so the two never bleed together.
 *
 * **Reads scope by *side*, not by a single kind.** "The customer's files" means
 * the originals *and* their translation, because a translation sits beside its
 * original rather than replacing it. `INTAKE_KINDS` / `RESPONSE_KINDS` carry
 * that, so adding a fifth kind can't silently fall out of a query.
 *
 * ⚠️ Retention: today the sweep empties intake files only. The settled northstar
 * is that **everything is swept together** — safe because the clock cannot start
 * until the customer has collected. That lands with Phase 6 of the rollout plan;
 * until then this file's behaviour is the old rule.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, submissionFiles } from "@/shared/db";
import {
  INTAKE_KINDS,
  RESPONSE_KINDS,
  type FileKind,
  type NewSubmissionFile,
  type SubmissionFile,
} from "../model/submissionFile";
import { fromFileRow } from "./submissionRow";

export async function addSubmissionFile(
  input: NewSubmissionFile,
  kind: FileKind = "intake",
): Promise<SubmissionFile> {
  const [row] = await db
    .insert(submissionFiles)
    .values({
      submissionId: input.submissionId,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      fileUrl: input.fileUrl,
      kind,
    })
    .returning();
  return fromFileRow(row);
}

/** One submission's intake files — originals and translations — oldest first. */
export async function listSubmissionFiles(
  submissionId: string,
): Promise<SubmissionFile[]> {
  const rows = await db
    .select()
    .from(submissionFiles)
    .where(
      and(
        eq(submissionFiles.submissionId, submissionId),
        inArray(submissionFiles.kind, INTAKE_KINDS),
      ),
    )
    .orderBy(asc(submissionFiles.uploadedAt));
  return rows.map(fromFileRow);
}

/** One submission's response files — the coach's, translated or not. */
export async function listFeedbackFiles(
  submissionId: string,
): Promise<SubmissionFile[]> {
  const rows = await db
    .select()
    .from(submissionFiles)
    .where(
      and(
        eq(submissionFiles.submissionId, submissionId),
        inArray(submissionFiles.kind, RESPONSE_KINDS),
      ),
    )
    .orderBy(asc(submissionFiles.uploadedAt));
  return rows.map(fromFileRow);
}

/**
 * Intake files for several submissions at once — the portal's read. One query
 * for a whole page; the caller groups by `submissionId`.
 */
export async function listFilesForSubmissions(
  submissionIds: string[],
): Promise<Map<string, SubmissionFile[]>> {
  const grouped = new Map<string, SubmissionFile[]>();
  if (submissionIds.length === 0) return grouped;

  const rows = await db
    .select()
    .from(submissionFiles)
    .where(
      and(
        inArray(submissionFiles.submissionId, submissionIds),
        inArray(submissionFiles.kind, INTAKE_KINDS),
      ),
    )
    .orderBy(asc(submissionFiles.uploadedAt));

  for (const row of rows) {
    const file = fromFileRow(row);
    const existing = grouped.get(file.submissionId);
    if (existing) existing.push(file);
    else grouped.set(file.submissionId, [file]);
  }
  return grouped;
}

export async function getSubmissionFile(
  id: string,
): Promise<SubmissionFile | null> {
  const [row] = await db
    .select()
    .from(submissionFiles)
    .where(eq(submissionFiles.id, id))
    .limit(1);
  return row ? fromFileRow(row) : null;
}

/**
 * How many files the customer has attached — checked against the upload limit.
 *
 * Counts `intake` only, not its translation: the limit is a promise to the
 * customer about what *they* may send, and Yuta's translations must not eat into
 * it.
 */
export async function countSubmissionFiles(
  submissionId: string,
): Promise<number> {
  const rows = await db
    .select({ id: submissionFiles.id })
    .from(submissionFiles)
    .where(
      and(
        eq(submissionFiles.submissionId, submissionId),
        eq(submissionFiles.kind, "intake"),
      ),
    );
  return rows.length;
}

/**
 * Forget the bytes, keep the record — the retention sweep, once the storage
 * object is gone.
 *
 * ⚠️ Intake only, for now. Phase 6 widens this to every kind.
 */
export async function clearFileLocators(submissionId: string): Promise<void> {
  await db
    .update(submissionFiles)
    .set({ fileUrl: null })
    .where(
      and(
        eq(submissionFiles.submissionId, submissionId),
        inArray(submissionFiles.kind, INTAKE_KINDS),
      ),
    );
}

/** Drop a file record outright — used when an upload half-completes. */
export async function deleteSubmissionFile(id: string): Promise<void> {
  await db.delete(submissionFiles).where(eq(submissionFiles.id, id));
}
