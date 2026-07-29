/**
 * Turns a succeeded PaymentIntent into a submission row.
 *
 * Called by both the Stripe webhook (the normal path) and the upload endpoint
 * (when the customer beats the webhook back to our site). `ensureSubmission` is
 * idempotent on the Stripe payment id, so whichever arrives first creates the
 * row and the other finds it. See ADR 003.
 */
import type Stripe from "stripe";
import {
  createSubmission,
  findByStripePaymentId,
} from "@/domains/submission";
import { FOCUS_OPTIONS, type Focus, type Submission } from "@/domains/submission";

/**
 * Read the player info back off the PaymentIntent.
 *
 * Metadata keys are written by `createPaymentIntent` using domain property
 * names, so they line up one-to-one with the fields below. Everything is
 * re-validated rather than trusted: metadata is echoed back from an external
 * system, and a missing key would otherwise write an empty string into Yuta's
 * base.
 */
export function submissionFromPaymentIntent(
  intent: Stripe.PaymentIntent,
): Parameters<typeof createSubmission>[0] {
  const meta = intent.metadata ?? {};

  // `receipt_email` is what we set at creation and what Stripe will mail a
  // receipt to, so it's the more authoritative of the two.
  const customerEmail = (
    intent.receipt_email ||
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
    stripePaymentId: intent.id,
    // `amount_received` is what actually cleared; `amount` is what was asked
    // for. They differ on a partial capture, and we want the truth.
    stripeAmount: (intent.amount_received ?? intent.amount) / 100,
  };
}

/**
 * Return the existing submission for this payment, or create it.
 *
 * `created` tells the caller whether this delivery was the first — the
 * payment-confirmation email is gated on it, so a Stripe retry can't send a
 * second one.
 */
export async function ensureSubmission(
  intent: Stripe.PaymentIntent,
): Promise<{ submission: Submission; created: boolean }> {
  const existing = await findByStripePaymentId(intent.id);
  if (existing) return { submission: existing, created: false };

  const submission = await createSubmission(submissionFromPaymentIntent(intent));
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
