/**
 * Files attached to a submission — everything the app does to the
 * `submission_files` table.
 *
 * The table holds two kinds, kept apart by the `kind` column: `submission` (the
 * customer's uploads) and `feedback` (the coach's response files). Every read
 * here is scoped to one kind, so the two never bleed together. Customer uploads
 * are emptied (not deleted) by the retention sweep; **feedback files are never
 * swept** — the customer's download depends on them.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, submissionFiles } from "@/shared/db";
import type {
  NewSubmissionFile,
  SubmissionFile,
} from "../model/submissionFile";
import { fromFileRow } from "./submissionRow";

export type FileKind = "submission" | "feedback";

export async function addSubmissionFile(
  input: NewSubmissionFile,
  kind: FileKind = "submission",
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

/** One submission's customer files, oldest first. */
export async function listSubmissionFiles(
  submissionId: string,
): Promise<SubmissionFile[]> {
  const rows = await db
    .select()
    .from(submissionFiles)
    .where(
      and(
        eq(submissionFiles.submissionId, submissionId),
        eq(submissionFiles.kind, "submission"),
      ),
    )
    .orderBy(asc(submissionFiles.uploadedAt));
  return rows.map(fromFileRow);
}

/** One submission's coach-feedback files, oldest first. */
export async function listFeedbackFiles(
  submissionId: string,
): Promise<SubmissionFile[]> {
  const rows = await db
    .select()
    .from(submissionFiles)
    .where(
      and(
        eq(submissionFiles.submissionId, submissionId),
        eq(submissionFiles.kind, "feedback"),
      ),
    )
    .orderBy(asc(submissionFiles.uploadedAt));
  return rows.map(fromFileRow);
}

/**
 * Customer files for several submissions at once — the portal's read. One query
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
        eq(submissionFiles.kind, "submission"),
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

/** How many customer files a submission carries — checked against the limit. */
export async function countSubmissionFiles(
  submissionId: string,
): Promise<number> {
  const rows = await db
    .select({ id: submissionFiles.id })
    .from(submissionFiles)
    .where(
      and(
        eq(submissionFiles.submissionId, submissionId),
        eq(submissionFiles.kind, "submission"),
      ),
    );
  return rows.length;
}

/**
 * Forget the bytes, keep the record — the retention sweep, once the storage
 * object is gone. Only customer uploads; feedback files are never swept.
 */
export async function clearFileLocators(submissionId: string): Promise<void> {
  await db
    .update(submissionFiles)
    .set({ fileUrl: null })
    .where(
      and(
        eq(submissionFiles.submissionId, submissionId),
        eq(submissionFiles.kind, "submission"),
      ),
    );
}

/** Drop a file record outright — used when an upload half-completes. */
export async function deleteSubmissionFile(id: string): Promise<void> {
  await db.delete(submissionFiles).where(eq(submissionFiles.id, id));
}
