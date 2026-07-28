/**
 * Stripe's inbound half — verifying its events and acting on them.
 *
 * The route that mounts this owns only HTTP: read the raw body, hand it here,
 * map the outcome to a status code. What a completed checkout *means* is here.
 */
import type Stripe from "stripe";
import { stripe } from "@/shared/stripe/client";
import { env } from "@/shared/config/env";
import { ensureSubmission } from "../model/fulfillment";
import { sendPaymentConfirmation } from "./paymentEmail";

/**
 * Verify a webhook delivery and return the event, or null if it isn't genuine.
 *
 * Takes the **raw, unparsed** body — signature verification is computed over
 * the exact bytes Stripe sent, so parsing first breaks it.
 */
export async function verifyStripeWebhook(
  rawBody: string,
  signature: string | null,
): Promise<Stripe.Event | null> {
  if (!signature) return null;

  try {
    return await stripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      env.stripeWebhookSecret,
    );
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return null;
  }
}

/**
 * Act on a verified event. Unhandled event types are a no-op.
 *
 * Throws on failure so the caller can return 500 and let Stripe retry — the
 * work is idempotent, so a retry is safe (ADR 003).
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type !== "checkout.session.completed") return;
  await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // A session can complete without being paid (async payment methods).
  if (session.payment_status !== "paid") return;

  const { submission, created } = await ensureSubmission(session);
  if (!created) {
    console.log(`[stripe webhook] row already exists for ${session.id}`);
    return;
  }

  // Gated on `created` so a redelivered webhook can't send a second email.
  if (submission.customerEmail) {
    const uploadUrl = `${env.siteUrl}/upload?session_id=${encodeURIComponent(session.id)}`;
    await sendPaymentConfirmation(submission.customerEmail, uploadUrl);
  }
}
