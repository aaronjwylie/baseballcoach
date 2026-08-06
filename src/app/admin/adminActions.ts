"use server";
/**
 * Admin-page actions on a submission that don't belong to another domain's
 * verbs. Archiving is the admin filing finished work away, so it lives with the
 * admin page rather than in the submission slice (which imports no other domain,
 * including account/auth). Admin-only — the guard is re-checked here.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/domains/operator";
import {
  FILE_KINDS,
  FILE_SETS,
  SUBMISSION_STATUSES,
  addSubmissionFile,
  clearFileLocator,
  listFilesByKinds,
  recordSubmissionEvent,
  archiveSubmission,
  getSubmission,
  isPaid,
  isReleased,
  unarchiveSubmission,
  updateSubmission,
  type FileKind,
  type FileSet,
  type SubmissionStatus,
} from "@/domains/submission";
import { approveAndComplete, resolveSubmission } from "@/domains/feedback";
import { getSettings } from "@/domains/settings";
import { storage, translationFileKey } from "@/shared/storage";

export async function archiveSubmissionAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("submissionId") ?? "");
  if (!id) return;

  const submission = await getSubmission(id);
  // Only completed work is archivable, and never twice.
  if (!submission || !isReleased(submission) || submission.archivedAt) {
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

/**
 * the admin approves the coach's uploaded feedback: complete the submission and send
 * the customer their download link. Guarded to `awaiting_approval` inside
 * `approveAndComplete`, so it's safe to call from a button.
 */
/**
 * Steps 6–7 and 11–12 — the admin puts a translation back.
 *
 * Both directions are one action because they are one act: the only difference
 * is which folder it lands in, which is the `kind` the caller names. Writing it
 * twice would be two chances to get the retention or the guard wrong.
 *
 * Translations don't count against the customer's upload limit — that limit is a
 * promise about what *they* may send, and the admin's working copies must not eat
 * into it.
 */
export async function uploadTranslationAction(
  formData: FormData,
): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("submissionId") ?? "");
  const rawKind = String(formData.get("kind") ?? "");
  if (!id) return;

  // Only the two translation folders are writable here. The originals are the
  // customer's and the coach's own uploads; an admin overwriting either would
  // destroy the record of what was actually submitted.
  if (rawKind !== "intake_translation" && rawKind !== "feedback_translation") {
    return;
  }
  const kind: FileKind = rawKind;

  const submission = await getSubmission(id);
  if (!submission || !isPaid(submission)) return;

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) return;

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const key = translationFileKey(id, kind, file.name);
    const fileUrl = await storage.save(key, bytes, file.type);
    await addSubmissionFile(
      {
        submissionId: id,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: bytes.byteLength,
        fileUrl,
      },
      kind,
    );
  }

  /*
    The status follows the folder, and only from the rung that makes sense.

    A translation arriving on a submission that has already moved past its
    translation step is filed without disturbing where it is — the admin adding a
    late copy shouldn't walk a released submission backwards.
  */
  /*
    Accept the upload from either side of the translation.

    `intake_translating` is the rung a submission is *on* while out for
    translation, so it is the ordinary case — and it was the one case this
    refused, because the guard only knew about `assigned`. A late upload onto an
    already-translated submission is filed without disturbing where it is.
  */
  const wasIntake =
    submission.status === "assigned" || submission.status === "intake_translating";
  const wasResponse =
    submission.status === "awaiting_approval" ||
    submission.status === "feedback_translating";

  if (kind === "intake_translation" && wasIntake) {
    await updateSubmission(id, { status: "intake_translated" });
  }
  if (kind === "feedback_translation" && wasResponse) {
    await updateSubmission(id, { status: "feedback_translated" });
  }

  revalidatePath("/admin");
}

/**
 * Phase 5 — the operator override. Purge a folder now, without waiting for a clock.
 *
 * The pipeline runs forward on its own; this is the handle for when it
 * shouldn't. A wrong file, something that should never have been sent, a
 * customer asking to be forgotten — none of those can wait thirty days, and none
 * of them is worth a bespoke feature each.
 *
 * **Deliberately blunt, and deliberately loud.** The bytes go and the records
 * stay, exactly as the scheduled sweep leaves them, so the portal can still say
 * what was there. Every purge writes an event, because a submission that lost
 * its files with no explanation is worse than one that still has them.
 */
export async function purgeFolderAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("submissionId") ?? "");
  const rawKind = String(formData.get("kind") ?? "");
  if (!id) return;
  if (!FILE_KINDS.includes(rawKind as FileKind)) return;
  const kind = rawKind as FileKind;

  const submission = await getSubmission(id);
  if (!submission) return;

  const files = await listFilesByKinds(id, [kind]);
  let removed = 0;
  for (const file of files) {
    if (!file.fileUrl) continue;
    try {
      await storage.remove(file.fileUrl);
      await clearFileLocator(file.id);
      removed += 1;
    } catch (err) {
      // One bad locator must not strand the rest of the folder.
      console.error(`[admin] purging ${file.id} failed:`, err);
    }
  }
  if (removed === 0) return;

  await noteSubmissionAction(
    id,
    submission.status,
    `purged ${removed} file${removed === 1 ? "" : "s"} from ${kind}`,
  );
  revalidatePath("/admin");
}

/**
 * Phase 5 — move a submission back to an earlier rung.
 *
 * **The only route backwards, and the answer to "what can be undone".** Not a
 * set of per-stage undo buttons: one general handle an operator can reach for
 * beats eleven specific ones nobody remembers exist. Work the admin won't accept goes
 * back to `in_review`; a mis-picked language set goes back to `assigned`.
 *
 * If the admin isn't satisfied with a coach's work he'll speak to them directly — the
 * system's job is to let him put the submission back where it needs to be, not
 * to model the conversation.
 *
 * **Forward-only rungs are refused.** `purged` cannot be undone, because the
 * bytes are gone; letting the status claim otherwise would make the queue lie
 * about what a customer can still download.
 */
export async function resetStatusAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("submissionId") ?? "");
  const rawStatus = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  /*
    Which line of the step they meant. **Recorded, never enforced** — only the
    rung is stored, because a chain line is derived from the data and has no
    column to set. It earns its place in the note: "back to Assigned" and "back
    to Assigned, at the hand-off" are different intentions, and the second is
    the one worth being able to say afterwards.
  */
  const substep = String(formData.get("substep") ?? "").trim();
  if (!id) return;
  if (!SUBMISSION_STATUSES.includes(rawStatus as SubmissionStatus)) return;
  const status = rawStatus as SubmissionStatus;

  const submission = await getSubmission(id);
  if (!submission || submission.status === status) return;
  // Nothing may be moved out of `purged`: the files it describes no longer
  // exist, and a status that implies otherwise is worse than no status at all.
  if (submission.status === "purged") return;
  // Nor back before payment — that would put a paid submission somewhere the
  // discard path is willing to delete it outright.
  if (!PAID_AT_STATUS_SAFE(status)) return;

  await updateSubmission(
    id,
    { status },
    [
      substep ? `reset — resume at “${substep}”` : "reset",
      reason || "by an admin",
    ].join(": "),
  );
  revalidatePath("/admin");
}

/** A reset may only land on a rung that still counts as paid. */
function PAID_AT_STATUS_SAFE(status: SubmissionStatus): boolean {
  return isPaid({ status });
}

/**
 * Write an event without changing the status — the trail's note-taking mode.
 *
 * Used by the purge, which changes files rather than state but still owes an
 * explanation. Re-recording the current status is the honest shape: nothing
 * moved, and something happened.
 */
async function noteSubmissionAction(
  id: string,
  status: SubmissionStatus,
  note: string,
): Promise<void> {
  await recordSubmissionEvent(id, status, note);
}

/**
 * Step 15 — the admin closes the job.
 *
 * Manual by decision, not by omission: the `collected` status makes the pending
 * work a list he can pull up, which is what the "he'll forget" objection actually
 * needed. Automating it later stays cheap.
 */
export async function resolveSubmissionAction(
  formData: FormData,
): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("submissionId") ?? "");
  if (!id) return;

  const settings = await getSettings();
  await resolveSubmission(id, settings.retainCollectedDays);
  revalidatePath("/admin");
}

/**
 * Rungs 5 and 10 — mark that the files have gone out for translation.
 *
 * **These rungs were unreachable.** Nothing in the app wrote them: uploading a
 * translation jumped straight from `assigned` to `intake_translated`, so a
 * submission sitting on the admin's laptop for two days was indistinguishable from
 * one he hadn't started. That is the exact thing the rung exists to show.
 *
 * It needs an explicit action because the download can't be it — an admin
 * downloads a file to check it as often as to translate it, and inferring intent
 * from a click would put submissions out for translation nobody sent.
 */
export async function sendForTranslationAction(
  formData: FormData,
): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("submissionId") ?? "");
  if (!id) return;

  const submission = await getSubmission(id);
  if (!submission) return;

  // Each side can only be sent from the rung that precedes it.
  const next =
    submission.status === "assigned"
      ? "intake_translating"
      : submission.status === "awaiting_approval"
        ? "feedback_translating"
        : null;
  if (!next) return;

  await updateSubmission(id, { status: next });
  revalidatePath("/admin");
}

export async function completeSubmissionAction(
  formData: FormData,
): Promise<void> {
  await requireRole("admin");
  const id = String(formData.get("submissionId") ?? "");
  if (!id) return;

  // Same fallback as step 8: an unrecognised choice sends the originals, which
  // are the set that always exists.
  const requested = String(formData.get("fileSet") ?? "original");
  const fileSet: FileSet = FILE_SETS.includes(requested as FileSet)
    ? (requested as FileSet)
    : "original";

  await approveAndComplete(id, fileSet);
  revalidatePath("/admin");
}
