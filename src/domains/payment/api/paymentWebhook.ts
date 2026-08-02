/**
 * Stripe's inbound half — verifying its events and acting on them.
 *
 * The route that mounts this owns only HTTP: read the raw body, hand it here,
 * map the outcome to a status code. What a succeeded payment *means* is here.
 */
import type Stripe from "stripe";
import { stripe } from "@/shared/stripe/client";
import { env } from "@/shared/config/env";
import { markSubmissionPaid } from "../model/fulfillment";
import { completePayment, handleFailedPayment } from "./paymentCompletion";

/**
 * The Stripe events this handler acts on — the single home for that fact.
 *
 * `scripts/stripe-webhook.ts` configures the dashboard endpoint from this list,
 * so what Stripe is told to send and what we actually handle cannot drift. That
 * drift is a silent failure: an endpoint subscribed to the wrong event means
 * payments succeed and no submission is ever marked paid.
 */
export const HANDLED_STRIPE_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
] as const;

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
    case "payment_intent.succeeded": {
      const result = await markSubmissionPaid(
        event.data.object as Stripe.PaymentIntent,
      );
      if (result) await completePayment(result);
      break;
    }

    case "payment_intent.payment_failed": {
      // The submission stays in `awaiting_payment` — the customer's files are
      // still there and they can try again. Logged for admin visibility.
      const intent = event.data.object as Stripe.PaymentIntent;
      console.log(
        JSON.stringify({
          event: "payment_failed",
          paymentIntentId: intent.id,
          submissionId: intent.metadata?.submissionId ?? null,
          reason: intent.last_payment_error?.message ?? "unknown",
        }),
      );
      await handleFailedPayment(intent);
      break;
    }

    default:
      break;
  }
}
