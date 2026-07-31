/**
 * The customer's uploaded files — everything the app does to the
 * `submission_files` table.
 *
 * Separate from `submissionApi` because it's a separate table with its own
 * lifecycle: rows are added as each upload lands, and are emptied (not deleted)
 * by the retention sweep. The record of *what was sent* outlives the bytes.
 */
import { asc, eq, inArray } from "drizzle-orm";
import { db, submissionFiles } from "@/shared/db";
import type {
  NewSubmissionFile,
  SubmissionFile,
} from "../model/submissionFile";
import { fromFileRow } from "./submissionRow";

export async function addSubmissionFile(
  input: NewSubmissionFile,
): Promise<SubmissionFile> {
  const [row] = await db
    .insert(submissionFiles)
    .values({
      submissionId: input.submissionId,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      fileUrl: input.fileUrl,
    })
    .returning();
  return fromFileRow(row);
}

/** One submission's files, oldest first — the order the customer added them. */
export async function listSubmissionFiles(
  submissionId: string,
): Promise<SubmissionFile[]> {
  const rows = await db
    .select()
    .from(submissionFiles)
    .where(eq(submissionFiles.submissionId, submissionId))
    .orderBy(asc(submissionFiles.uploadedAt));
  return rows.map(fromFileRow);
}

/**
 * Files for several submissions at once — the portal's read.
 *
 * One query for a whole page of submissions rather than one per row; the caller
 * groups by `submissionId`.
 */
export async function listFilesForSubmissions(
  submissionIds: string[],
): Promise<Map<string, SubmissionFile[]>> {
  const grouped = new Map<string, SubmissionFile[]>();
  if (submissionIds.length === 0) return grouped;

  const rows = await db
    .select()
    .from(submissionFiles)
    .where(inArray(submissionFiles.submissionId, submissionIds))
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

/** How many files a submission already carries — checked against the limit. */
export async function countSubmissionFiles(
  submissionId: string,
): Promise<number> {
  const rows = await db
    .select({ id: submissionFiles.id })
    .from(submissionFiles)
    .where(eq(submissionFiles.submissionId, submissionId));
  return rows.length;
}

/**
 * Forget the bytes, keep the record. Called by the retention sweep once the
 * storage object is gone.
 */
export async function clearFileLocators(submissionId: string): Promise<void> {
  await db
    .update(submissionFiles)
    .set({ fileUrl: null })
    .where(eq(submissionFiles.submissionId, submissionId));
}

/** Drop a file record outright — used when an upload half-completes. */
export async function deleteSubmissionFile(id: string): Promise<void> {
  await db.delete(submissionFiles).where(eq(submissionFiles.id, id));
}
