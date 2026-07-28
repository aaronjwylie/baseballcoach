import { handleStripeEvent, verifyStripeWebhook } from "@/domains/payment";

/**
 * Stripe webhook mount point.
 *
 * HTTP only: raw body in, status code out. Verification and meaning live in
 * `domains/payment/api/paymentWebhook.ts`.
 *
 * The body must be read as text, not JSON — the signature is computed over the
 * exact bytes Stripe sent.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const event = await verifyStripeWebhook(rawBody, signature);
  if (!event) {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    // 500 so Stripe retries; the work is idempotent.
    console.error("[stripe webhook] handler error:", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
