"use server";
/**
 * Admin verbs on coaches: create one, assign one to a submission. Both are
 * admin-only — the guard is re-checked here, not trusted from the UI.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/domains/account";
import {
  FOCUS_OPTIONS,
  assignSubmissionCoach,
  type Focus,
} from "@/domains/submission";
import { createCoach, updateCoach } from "./coachApi";

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
  const languages = String(formData.get("languages") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return { error: "Enter a name, a valid email, and a password of at least 8 characters." };
  }

  try {
    await createCoach({ name, email, password, specialties, languages });
  } catch {
    return { error: "Could not create the coach — is that email already in use?" };
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
  const specialties = formData.getAll("specialties").map(String).filter(isFocus);
  const languages = String(formData.get("languages") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isActive = formData.get("isActive") === "on";

  if (!id || !name) return { error: "A name is required." };

  try {
    await updateCoach(id, { name, specialties, languages, isActive });
  } catch {
    return { error: "Could not update the coach." };
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
  await assignSubmissionCoach(submissionId, coachId);
  revalidatePath("/admin");
}
