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
import { clearFlowSession, readFlowSession } from "@/domains/submission";

export type ConfirmOutcome =
  | { ok: true }
  | { ok: false; error: string; gone?: true };

export async function confirmPaymentForFlow(
  paymentIntentId: string,
): Promise<ConfirmOutcome> {
  const submissionId = await readFlowSession();
  if (!submissionId) {
    /*
      A lapsed window at the payment step is the worst place for it, so say
      something true rather than something reassuring: if the card *did* go
      through, the webhook still fulfils the submission independently (ADR 003),
      and a receipt will arrive. What we can't do is show it to this browser.
    */
    return {
      ok: false,
      gone: true,
      error:
        "Your session timed out before we could confirm. If your card went through you'll still get a receipt — please check your email before paying again.",
    };
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

  // Let go of the submission. The confirmation the customer sees next is either
  // client state (inline card) or `/start?paid=1` (redirect); neither reads this
  // cookie, and leaving it set would mean a later reload landed on a finished
  // submission.
  await clearFlowSession();

  return { ok: true };
}
