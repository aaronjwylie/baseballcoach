"use server";
/**
 * Admin-page actions on a submission that don't belong to another domain's
 * verbs. Archiving is the admin filing finished work away, so it lives with the
 * admin page rather than in the submission slice (which imports no other domain,
 * including account/auth). Admin-only — the guard is re-checked here.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/domains/account";
import {
  archiveSubmission,
  getSubmission,
  unarchiveSubmission,
} from "@/domains/submission";

export async function archiveSubmissionAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("submissionId") ?? "");
  if (!id) return;

  const submission = await getSubmission(id);
  // Only completed work is archivable, and never twice.
  if (!submission || submission.status !== "complete" || submission.archivedAt) {
    return;
  }

  await archiveSubmission(id);
  revalidatePath("/admin");
}

export async function unarchiveSubmissionAction(
  formData: FormData,
): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("submissionId") ?? "");
  if (!id) return;

  await unarchiveSubmission(id);
  revalidatePath("/admin");
}
