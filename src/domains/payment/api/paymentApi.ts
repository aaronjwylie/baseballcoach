/**
 * Stripe PaymentIntents — the payment domain's outbound I/O.
 *
 * We use **Elements, not hosted Checkout** (ADR 005): the customer never leaves
 * our domain, so what we create here is a PaymentIntent whose `clientSecret` the
 * browser confirms in place.
 *
 * The route handler owns HTTP; this owns what it means to charge for a review.
 */
import type Stripe from "stripe";
import { stripe } from "@/shared/stripe/client";
import { env } from "@/shared/config/env";
import { site } from "@/shared/config/site";
import type { SubmissionInput } from "@/domains/submission";

export interface CreatedIntent {
  clientSecret: string;
  paymentIntentId: string;
  /** Echoed back so the payment step can show what's being charged. */
  amountCents: number;
  currency: string;
}

/**
 * Resolve what to charge.
 *
 * A pre-created Stripe Price is supported for the client's convenience, but a
 * PaymentIntent takes a raw amount rather than a price — so when one is
 * configured we read the amount off it instead of hardcoding. That keeps
 * "what it costs" answerable in one place per environment.
 */
async function resolveAmount(): Promise<{ amount: number; currency: string }> {
  if (!env.stripePriceId) {
    return { amount: site.price.amountCents, currency: site.price.currency };
  }

  const price = await stripe().prices.retrieve(env.stripePriceId);
  if (typeof price.unit_amount !== "number") {
    throw new Error(
      `Stripe price ${env.stripePriceId} has no unit_amount — it may be a tiered or metered price, which this flow can't charge.`,
    );
  }
  return { amount: price.unit_amount, currency: price.currency };
}

/**
 * Create a PaymentIntent for one review.
 *
 * Player info rides on `metadata` under domain property names, so fulfillment
 * reads it straight across with no translation. `receipt_email` is set so Stripe
 * can issue its own receipt and so the address survives on the intent itself.
 */
export async function createPaymentIntent(
  input: SubmissionInput,
): Promise<CreatedIntent> {
  const { customerEmail, playerName, playerAge, focus, customerNotes } = input;
  const { amount, currency } = await resolveAmount();

  const intent = await stripe().paymentIntents.create({
    amount,
    currency,
    receipt_email: customerEmail,
    description: `${site.name} — video review for ${playerName}`,
    // Let the Stripe dashboard decide which methods are offered, so enabling
    // Apple/Google Pay later is a dashboard toggle rather than a deploy.
    automatic_payment_methods: { enabled: true },
    metadata: {
      customerEmail,
      playerName,
      playerAge: playerAge?.toString() ?? "",
      focus: focus ?? "",
      customerNotes: customerNotes ?? "",
    },
  });

  if (!intent.client_secret) {
    throw new Error("Stripe did not return a client secret");
  }

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amountCents: amount,
    currency,
  };
}

/**
 * Retrieve an intent and confirm it actually succeeded.
 *
 * Verified against Stripe rather than our own Airtable row: the row could be
 * stale, and the id arrives from the browser. `null` means no such intent (404
 * territory); `"unpaid"` means it exists but hasn't succeeded (402).
 */
export async function getSucceededPaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent | null | "unpaid"> {
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe().paymentIntents.retrieve(paymentIntentId);
  } catch {
    return null;
  }
  return intent.status === "succeeded" ? intent : "unpaid";
}
