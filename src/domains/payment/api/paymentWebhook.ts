/**
 * Stripe's inbound half — verifying its events and acting on them.
 *
 * The route that mounts this owns only HTTP: read the raw body, hand it here,
 * map the outcome to a status code. What a succeeded payment *means* is here.
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
 * Act on a verified event. Unhandled types are a no-op.
 *
 * Throws on failure so the caller can return 500 and let Stripe retry — the
 * work is idempotent, so a retry is safe (ADR 003).
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case "payment_intent.payment_failed": {
      // No row is created for a failed payment — there's nothing to fulfil.
      // Logged for admin visibility per CLAUDE.md §9.
      const intent = event.data.object as Stripe.PaymentIntent;
      console.log(
        JSON.stringify({
          event: "payment_failed",
          paymentIntentId: intent.id,
          email: intent.receipt_email,
          reason: intent.last_payment_error?.message ?? "unknown",
        }),
      );
      break;
    }

    default:
      break;
  }
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  const { submission, created } = await ensureSubmission(intent);
  if (!created) {
    console.log(`[stripe webhook] row already exists for ${intent.id}`);
    return;
  }

  // Gated on `created` so a redelivered webhook can't send a second email.
  if (submission.customerEmail) {
    const uploadUrl = `${env.siteUrl}/upload?payment_intent=${encodeURIComponent(intent.id)}`;
    await sendPaymentConfirmation(submission.customerEmail, uploadUrl);
  }
}
