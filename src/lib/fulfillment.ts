/**
 * Turns a paid Stripe Checkout session into a submission row.
 *
 * Used by both the Stripe webhook (the normal path) and the upload endpoint
 * (a fallback, in case the customer returns before the webhook lands). Both
 * call `ensureSubmission`, which is idempotent on the Stripe session ID.
 */
import type Stripe from "stripe";
import {
  createSubmission,
  findBySessionId,
  type SubmissionFields,
  type SubmissionRecord,
} from "@/lib/airtable";

export function fieldsFromSession(
  session: Stripe.Checkout.Session,
): Partial<SubmissionFields> {
  const meta = session.metadata ?? {};
  const email =
    meta.email ||
    session.customer_details?.email ||
    session.customer_email ||
    "";
  return {
    Email: email,
    "Player Name": meta.playerName || "Unknown",
    "Player Age": meta.playerAge || undefined,
    Sport: meta.focus || undefined,
    Notes: meta.notes || undefined,
    Status: "Awaiting Upload",
    "Stripe Session ID": session.id,
    "Created At": new Date().toISOString(),
  };
}

/**
 * Return the existing submission for this session, or create it. Returns the
 * record plus whether it was newly created (so callers can decide whether to
 * send the payment-confirmation email).
 */
export async function ensureSubmission(
  session: Stripe.Checkout.Session,
): Promise<{ record: SubmissionRecord; created: boolean }> {
  const existing = await findBySessionId(session.id);
  if (existing) return { record: existing, created: false };

  const record = await createSubmission(fieldsFromSession(session));
  return { record, created: true };
}
