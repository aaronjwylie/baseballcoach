"use server";
/**
 * Admin verbs on coaches: create one, assign one to a submission. Both are
 * admin-only — the guard is re-checked here, not trusted from the UI.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/domains/operator";
import {
  FILE_SETS,
  FOCUS_OPTIONS,
  assignSubmissionCoach,
  getSubmission,
  kindsForSet,
  listFilesByKinds,
  markSubmissionSentToCoach,
  noteEmailSent,
  updateSubmission,
  type FileSet,
  type Focus,
} from "@/domains/submission";
import { storage, coachImageKey } from "@/shared/storage";
import { languagesForChoice, readLanguageChoice } from "@/domains/submission/model/submission";
import { DEFAULT_LANGUAGE_CHOICE } from "../model/coach";
import { createCoach, updateCoach, getCoach } from "./coachApi";
import { sendAssignmentEmail } from "./coachEmail";

/** Save an uploaded coach photo, returning its locator — or null if none was
 *  chosen. The image field is optional on both forms. */
async function saveCoachImage(
  coachId: string,
  formData: FormData,
): Promise<string | null> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return storage.save(
    coachImageKey(coachId, file.name),
    bytes,
    file.type || "application/octet-stream",
  );
}

export type CoachFormState = { error: string } | { ok: true } | undefined;

function isFocus(value: string): value is Focus {
  return (FOCUS_OPTIONS as readonly string[]).includes(value);
}

export async function createCoachAction(
  _prev: CoachFormState,
  formData: FormData,
): Promise<CoachFormState> {
  await requireRole("admin");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const specialties = formData.getAll("specialties").map(String).filter(isFocus);
  const languages = languagesForChoice(readLanguageChoice(formData.get("languages"), DEFAULT_LANGUAGE_CHOICE));
  const bio = String(formData.get("bio") ?? "").trim();

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return { error: "Enter a name, a valid email, and a password of at least 8 characters." };
  }

  let coachId: string;
  try {
    const coach = await createCoach({ name, email, password, specialties, languages, bio });
    coachId = coach.id;
  } catch {
    return { error: "Could not create the coach — is that email already in use?" };
  }

  // The photo needs the coach's id, so it's saved after creation. A photo
  // failure isn't fatal — the coach exists and it can be added on the edit form.
  try {
    const imageUrl = await saveCoachImage(coachId, formData);
    if (imageUrl) await updateCoach(coachId, { imageUrl });
  } catch (err) {
    console.error("[coach create] photo failed:", err);
  }

  revalidatePath("/admin/coaches");
  return { ok: true };
}

export async function updateCoachAction(
  _prev: CoachFormState,
  formData: FormData,
): Promise<CoachFormState> {
  await requireRole("admin");

  const id = String(formData.get("coachId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const specialties = formData.getAll("specialties").map(String).filter(isFocus);
  const languages = languagesForChoice(readLanguageChoice(formData.get("languages"), DEFAULT_LANGUAGE_CHOICE));
  const isActive = formData.get("isActive") === "on";
  const password = String(formData.get("password") ?? "");
  const bio = String(formData.get("bio") ?? "").trim();

  if (!id || !name) return { error: "A name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password && password.length < 8) {
    return {
      error: "A new password must be at least 8 characters (or leave it blank).",
    };
  }

  // A new photo replaces the old one; the old object is removed so it doesn't
  // orphan in storage.
  let imageUrl: string | undefined;
  try {
    const url = await saveCoachImage(id, formData);
    if (url) {
      imageUrl = url;
      const existing = await getCoach(id);
      if (existing?.imageUrl) void storage.remove(existing.imageUrl).catch(() => {});
    }
  } catch (err) {
    console.error("[coach edit] photo failed:", err);
    return { error: "Could not save the photo. Please try again." };
  }

  try {
    await updateCoach(id, {
      name,
      email,
      specialties,
      languages,
      isActive,
      bio,
      ...(password ? { password } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    });
  } catch {
    return { error: "Could not update the coach — is that email already in use?" };
  }

  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${id}`);
  return { ok: true };
}

export async function assignCoachAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const submissionId = String(formData.get("submissionId") ?? "");
  const coachId = String(formData.get("coachId") ?? "");
  if (!submissionId || !coachId) return;

  /*
    Reassignment stops once the work has been handed over.

    The UI already hides the dropdown from that point, but the guard was UI-only:
    a stale tab could pull a submission out from under a coach who had already
    been emailed it — or reassign one the customer has since received. The role
    was checked here and the status wasn't, which is the weaker half of the pair.
  */
  const submission = await getSubmission(submissionId);
  if (!submission) return;
  if (submission.status !== "new" && submission.status !== "assigned") return;

  await assignSubmissionCoach(submissionId, coachId);
  revalidatePath("/admin");
}

/**
 * Hand a submission to its assigned coach: email them the customer's details and
 * a download link per file, then move `assigned` → `sent_to_coach`. Only acts on
 * an `assigned` row, so a double-click can't re-notify or skip a step.
 *
 * It stops at "sent". `in_review` is earned when the coach actually downloads
 * something — see `noteCoachCollected`.
 */
export async function notifyCoachAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return;

  const submission = await getSubmission(submissionId);
  /*
    Two rungs can hand off, not one.

    A submission whose intake has been translated sits at `intake_translated`,
    not `assigned` — so a guard that only accepted `assigned` made the hand-off
    **impossible for exactly the submissions that needed translating**. The
    button appeared, the action returned, and nothing happened. Found by
    simulating the translation path, which no browser test had walked.
  */
  const handOffable =
    submission?.status === "assigned" || submission?.status === "intake_translated";
  if (!submission || !handOffable || !submission.assignedCoachId) {
    return;
  }

  const coach = await getCoach(submission.assignedCoachId);
  if (!coach) return;

  /*
    Step 8's curation, and the reason the radio can't live on assignment: at
    assignment the translation doesn't exist yet to choose.

    Falls back to the originals rather than to nothing. A missing or unparseable
    choice must not hand a coach an empty download — the originals are the set
    that always exists, so they're the safe default.
  */
  const requested = String(formData.get("fileSet") ?? "original");
  const fileSet: FileSet = FILE_SETS.includes(requested as FileSet)
    ? (requested as FileSet)
    : "original";

  const files = await listFilesByKinds(
    submissionId,
    kindsForSet("intake", fileSet),
  );
  if (files.length === 0) return;

  // Best-effort mail (ADR 004) — the hand-off proceeds even if it fails, but
  // the trail records whether it actually landed.
  const result = await sendAssignmentEmail({
    to: coach.email,
    coachName: coach.name,
    submission,
    files,
  });
  void noteEmailSent(submissionId, "③ hand-off → coach", result);

  // Record what they were actually sent. "What did we give them?" is asked
  // later, and by then the folders may hold more than they did today.
  await updateSubmission(submissionId, { coachFileSet: fileSet });
  await markSubmissionSentToCoach(submissionId);
  revalidatePath("/admin");
}
