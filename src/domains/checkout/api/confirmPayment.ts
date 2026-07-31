/**
 * Confirming a payment, for both ways a customer can arrive at one.
 *
 * A plain module rather than a Server Action, because it has **two callers with
 * two shapes**: the action the browser calls when a card clears inline, and the
 * route handler Stripe redirects to when the method needed a detour (3-D
 * Secure, a wallet). Writing it once is what keeps those two paths from drifting
 * into different notions of "paid".
 *
 * The status is re-read **from Stripe**, never from the caller's claim — the id
 * arrives from the browser either way, and a forged one must not be able to mark
 * a submission paid.
 */
import {
  completePayment,
  getSucceededPaymentIntent,
  markSubmissionPaid,
} from "@/domains/payment";
import { readFlowSession } from "@/domains/submission";

export type ConfirmOutcome =
  | { ok: true }
  | { ok: false; error: string };

export async function confirmPaymentForFlow(
  paymentIntentId: string,
): Promise<ConfirmOutcome> {
  const submissionId = await readFlowSession();
  if (!submissionId) {
    return { ok: false, error: "Your session has expired. Please start again." };
  }

  const intent = await getSucceededPaymentIntent(paymentIntentId);
  if (intent === null) return { ok: false, error: "We couldn't find that payment." };
  if (intent === "unpaid") {
    return { ok: false, error: "That payment hasn't completed yet." };
  }

  // The intent must belong to *this* browser's submission.
  if (intent.metadata?.submissionId !== submissionId) {
    return { ok: false, error: "That payment doesn't match this submission." };
  }

  const result = await markSubmissionPaid(intent);
  if (!result) return { ok: false, error: "We couldn't confirm that payment." };

  // Best-effort receipt, gated on `justPaid` inside — the webhook may already
  // have sent it.
  await completePayment(result);

  return { ok: true };
}
