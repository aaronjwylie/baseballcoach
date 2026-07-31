import { NextResponse } from "next/server";
import { env } from "@/shared/config/env";
import { confirmPaymentForFlow } from "@/domains/checkout/api/confirmPayment";

/**
 * Where Stripe sends a customer back after a payment method that needed a
 * detour — 3-D Secure, or a wallet that leaves the page.
 *
 * A route handler rather than an effect in the flow component: confirming is a
 * server job (it reads the flow cookie and writes the submission), and doing it
 * here means the customer lands on `/start` with the work already done. The
 * alternative — confirm from a `useEffect` on the way back in — is a render that
 * sets state on mount, which is both slower and the thing React tells you not to
 * do.
 *
 * The submission is left in the flow cookie so `/start` can render the
 * confirmation with the player's name and file count still in hand.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentIntentId = url.searchParams.get("payment_intent")?.trim();

  const start = new URL("/start", env.siteUrl);

  if (!paymentIntentId) {
    start.searchParams.set("payment", "missing");
    return NextResponse.redirect(start);
  }

  const outcome = await confirmPaymentForFlow(paymentIntentId);
  if (!outcome.ok) {
    console.error("[payment/return] confirmation failed:", outcome.error);
    start.searchParams.set("payment", "failed");
  }

  return NextResponse.redirect(start);
}
