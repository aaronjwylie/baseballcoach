"use server";
/**
 * The coach's action on their own feedback: hand the attached files to the admin for
 * approval. Operator-gated and ownership-checked here — a coach may only send
 * their own assignments, the admin may send anyone's — because a Server Action is
 * a public endpoint, not a trusted call from the page that rendered it.
 */
import { revalidatePath } from "next/cache";
import { getSession } from "@/domains/operator";
import { getCoachByOperatorId } from "@/domains/coach";
import { getSubmission } from "@/domains/submission";
import { sendFeedbackForApproval } from "./feedbackApi";

export async function sendFeedbackForApprovalAction(
  submissionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in." };

  const submission = await getSubmission(submissionId);
  if (!submission) return { ok: false, error: "That submission doesn't exist." };

  if (session.role !== "admin") {
    const coach = await getCoachByOperatorId(session.operatorId);
    if (!coach || submission.assignedCoachId !== coach.id) {
      return { ok: false, error: "That isn't your submission." };
    }
  }

  const result = await sendFeedbackForApproval(submissionId);
  if (!result) {
    return { ok: false, error: "Attach at least one file before sending." };
  }

  revalidatePath("/coach");
  return { ok: true };
}
