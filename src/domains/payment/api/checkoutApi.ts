/**
 * Stripe checkout — the payment domain's outbound I/O.
 *
 * The route handler owns HTTP concerns (parsing, status codes); this owns what
 * it means to charge for a review. Player info rides on the session's metadata
 * under domain property names, so fulfillment reads it straight across.
 *
 * TODO(2026-07-28, Ben): becomes createPaymentIntent when the Elements rebuild
 * lands (ADR 005). The Airtable column is already named for the role rather
 * than the Stripe object, so that change doesn't reach storage.
 */
import type Stripe from "stripe";
import { stripe } from "@/shared/stripe/client";
import { env } from "@/shared/config/env";
import { site } from "@/shared/config/site";
import type { SubmissionInput } from "@/domains/submission";

/**
 * Prefer a pre-created Price when one is configured; otherwise price inline
 * from site.ts, so the client doesn't need to set up a Stripe Product first.
 */
function lineItem(
  playerName: string,
): Stripe.Checkout.SessionCreateParams.LineItem {
  if (env.stripePriceId) {
    return { price: env.stripePriceId, quantity: 1 };
  }
  return {
    quantity: 1,
    price_data: {
      currency: site.price.currency,
      unit_amount: site.price.amountCents,
      product_data: {
        name: `${site.name} — Single Video Review`,
        description: `Personal coaching breakdown for ${playerName}.`,
      },
    },
  };
}

/** Create a Checkout Session and return its hosted URL. */
export async function createCheckoutSession(
  input: SubmissionInput,
): Promise<string> {
  const { customerEmail, playerName, playerAge, focus, customerNotes } = input;

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [lineItem(playerName)],
    customer_email: customerEmail,
    success_url: `${env.siteUrl}/upload?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.siteUrl}/start?canceled=1`,
    metadata: {
      customerEmail,
      playerName,
      playerAge: playerAge?.toString() ?? "",
      focus: focus ?? "",
      customerNotes: customerNotes ?? "",
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return session.url;
}

/**
 * Retrieve a session and confirm it was actually paid.
 *
 * Verified against Stripe rather than our own Airtable row: the row could be
 * stale, and the session ID arrives from the browser. Returns null when the
 * session doesn't exist so the caller can 404 rather than 500.
 */
export async function getPaidSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session | null | "unpaid"> {
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return null;
  }
  return session.payment_status === "paid" ? session : "unpaid";
}
