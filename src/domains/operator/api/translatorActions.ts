"use server";
/**
 * Translator actions — the admin choosing who carries a leg.
 *
 * Split from `coachActions.ts`, where this lived for a day. A file named for
 * one role holding another role's verbs is the one-stem violation
 * `_NomenclatureLaw.md` §2 exists to catch, and it is worth more here than
 * usual: the two roles are genuinely similar, which is exactly when a reader
 * needs the filename to tell them which one they are looking at.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "./dal";
import { getSubmission, assignSubmissionTranslator } from "@/domains/submission";

/**
 * Pick who translates one leg. Admin-only.
 *
 * Guarded on the rung as well as the role, for the same reason
 * `assignCoachAction` is: the UI hides the control once the work has gone out,
 * but a stale tab can still post — and pulling a submission out from under a
 * translator who has already been emailed it is exactly what the UI guard
 * cannot cover.
 */
export async function assignTranslatorAction(formData: FormData): Promise<void> {
  await requireRole("admin");
  const submissionId = String(formData.get("submissionId") ?? "");
  const operatorId = String(formData.get("operatorId") ?? "");
  const leg = String(formData.get("leg") ?? "");
  if (!submissionId || !operatorId) return;
  if (leg !== "intake_translation" && leg !== "feedback_translation") return;

  const submission = await getSubmission(submissionId);
  if (!submission) return;

  // Each leg is staffed from the rung before it, or re-staffed from its own —
  // a second look at the dropdown before sending is ordinary.
  const allowed =
    leg === "intake_translation"
      ? submission.status === "assigned" ||
        submission.status === "intake_translator_assigned"
      : submission.status === "awaiting_approval" ||
        submission.status === "feedback_translator_assigned";
  if (!allowed) return;

  await assignSubmissionTranslator(submissionId, operatorId, leg);
  revalidatePath("/admin");
}
