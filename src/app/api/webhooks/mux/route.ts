import { handleMuxEvent, verifyMuxWebhook } from "@/domains/upload";

/**
 * Mux webhook mount point.
 *
 * HTTP only: raw body in, status code out. Verification and meaning live in
 * `domains/upload/api/uploadWebhook.ts`.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const event = await verifyMuxWebhook(rawBody, request.headers);
  if (!event) {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await handleMuxEvent(event);
  } catch (err) {
    // 500 so Mux retries; the handlers are idempotent.
    console.error(`[mux webhook] handler error for ${event.type}:`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
