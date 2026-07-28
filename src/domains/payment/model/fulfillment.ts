/**
 * Turns a paid Stripe session into a submission row.
 *
 * Called by both the Stripe webhook (the normal path) and the upload endpoint
 * (when the customer beats the webhook back to our site). `ensureSubmission` is
 * idempotent on the Stripe payment ID, so whichever arrives first creates the
 * row and the other finds it. See ADR 003.
 */
import type Stripe from "stripe";
import {
  createSubmission,
  findByStripePaymentId,
} from "@/domains/submission";
import { FOCUS_OPTIONS, type Focus, type Submission } from "@/domains/submission";

/**
 * Read the player info back off the Stripe session.
 *
 * Metadata keys are written by the checkout route using domain property names,
 * so they line up one-to-one with the fields below. Everything is re-validated
 * rather than trusted: metadata is echoed back from an external system, and a
 * missing key here would otherwise write an empty string into Yuta's base.
 */
export function submissionFromSession(
  session: Stripe.Checkout.Session,
): Parameters<typeof createSubmission>[0] {
  const meta = session.metadata ?? {};

  // The customer can change their email inside Stripe's flow, so what Stripe
  // reports is more current than what they typed on our form.
  const customerEmail = (
    session.customer_details?.email ||
    session.customer_email ||
    meta.customerEmail ||
    ""
  ).toLowerCase();

  return {
    customerEmail,
    playerName: meta.playerName || "Unknown",
    playerAge: parsePositiveInt(meta.playerAge),
    focus: parseFocus(meta.focus),
    customerNotes: meta.customerNotes || undefined,
    status: "Awaiting Upload",
    stripePaymentId: session.id,
    stripeAmount:
      typeof session.amount_total === "number"
        ? session.amount_total / 100
        : undefined,
  };
}

/**
 * Return the existing submission for this session, or create it.
 *
 * `created` tells the caller whether this delivery was the first — the
 * payment-confirmation email is gated on it, so a Stripe retry can't send a
 * second one.
 */
export async function ensureSubmission(
  session: Stripe.Checkout.Session,
): Promise<{ submission: Submission; created: boolean }> {
  const existing = await findByStripePaymentId(session.id);
  if (existing) return { submission: existing, created: false };

  const submission = await createSubmission(submissionFromSession(session));
  return { submission, created: true };
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function parseFocus(value: string | undefined): Focus | undefined {
  if (!value) return undefined;
  return (FOCUS_OPTIONS as readonly string[]).includes(value)
    ? (value as Focus)
    : undefined;
}
