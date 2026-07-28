import {
  isAuthorizedFeedbackWebhook,
  notifyFeedbackReady,
} from "@/domains/feedback";

/**
 * Feedback-ready mount point, called by an Airtable automation when a
 * submission's Status becomes "Complete".
 *
 * HTTP only. The auth check and the notification live in
 * `domains/feedback/api/feedbackWebhook.ts`.
 *
 * Everything except a genuine failure answers 200 — a mistimed automation run
 * is a no-op, not something Airtable should retry.
 */
export async function POST(request: Request) {
  if (!isAuthorizedFeedbackWebhook(request.headers.get("x-webhook-secret"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { recordId?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }

  const recordId =
    typeof body.recordId === "string" ? body.recordId.trim() : "";
  if (!recordId) {
    return new Response("Missing recordId", { status: 400 });
  }

  try {
    const result = await notifyFeedbackReady(recordId);
    if (result === "not-found") {
      return new Response("Not found", { status: 404 });
    }
    return new Response(result, { status: 200 });
  } catch (err) {
    // 500 so Airtable retries a transient failure.
    console.error("[feedback webhook] failed:", err);
    return new Response("Handler error", { status: 500 });
  }
}
