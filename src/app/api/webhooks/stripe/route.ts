import type Stripe from "stripe";
import { stripe } from "@/shared/stripe/client";
import { env } from "@/shared/config/env";
import { ensureSubmission } from "@/domains/payment";
import { sendPaymentConfirmation } from "@/domains/payment";

/**
 * Stripe → Airtable glue. On `checkout.session.completed` we create the
 * submission row (status "Awaiting Upload") and email the customer a link to
 * the upload page. Idempotent: a duplicate delivery for the same session is a
 * no-op, since the upload endpoint may have already created the row.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      payload,
      signature,
      env.stripeWebhookSecret,
    );
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await handleCheckoutCompleted(session);
    } catch (err) {
      // Return 500 so Stripe retries; the work is idempotent.
      console.error("[stripe webhook] handler error:", err);
      return new Response("Handler error", { status: 500 });
    }
  }

  return new Response("ok", { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Only fulfil paid sessions.
  if (session.payment_status !== "paid") return;

  const { submission, created } = await ensureSubmission(session);
  if (!created) {
    console.log(`[stripe webhook] row already exists for ${session.id}`);
    return;
  }

  if (submission.customerEmail) {
    const uploadUrl = `${env.siteUrl}/upload?session_id=${encodeURIComponent(session.id)}`;
    await sendPaymentConfirmation(submission.customerEmail, uploadUrl);
  }
}
