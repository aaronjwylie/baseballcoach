import { timingSafeEqual } from "node:crypto";
import {
  getSubmission,
  updateSubmission,
} from "@/integrations/airtable/submissions";
import { env } from "@/lib/env";
import { sendFeedbackReady } from "@/lib/email";

/**
 * Notify-on-complete hook. An Airtable automation ("Send request" action)
 * calls this when a submission's Status becomes "Complete". We look the row up,
 * confirm it's complete with a feedback link, email the customer their
 * "feedback ready" link, and mark the row so a re-fire won't email twice.
 *
 * This is the final piece of the customer flow: earlier steps redirect the
 * customer in-browser, but by the time feedback is ready they've long left the
 * site — so email is the only way to reach them (they can also poll /status).
 *
 * Auth: a shared secret in the `x-webhook-secret` header, compared to
 * AIRTABLE_WEBHOOK_SECRET. Configure the same value on the Airtable automation.
 *
 * Expected JSON body: `{ "recordId": "rec..." }` — the Airtable record ID,
 * available in the automation as the triggering record's id.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
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

  let submission;
  try {
    submission = await getSubmission(recordId);
  } catch (err) {
    console.error("[airtable webhook] lookup failed:", err);
    // 500 so Airtable retries a transient failure.
    return new Response("Lookup failed", { status: 500 });
  }
  if (!submission) {
    return new Response("Not found", { status: 404 });
  }

  // Only fire for genuinely-complete rows that have a link and an address.
  // Anything else is a no-op (200) so a mistimed automation run isn't retried.
  if (
    submission.status !== "Complete" ||
    !submission.feedbackVideoUrl ||
    !submission.customerEmail
  ) {
    return new Response("Not ready", { status: 200 });
  }

  // Idempotency: skip if we've already emailed this row. Relies on the
  // "Feedback Emailed At" column; if it doesn't exist the field is just
  // undefined and we fall back to Airtable's fire-once-per-record trigger.
  if (submission.feedbackEmailedAt) {
    return new Response("Already sent", { status: 200 });
  }

  // sendFeedbackReady is best-effort and never throws (ADR 004), so a mail
  // failure won't trigger an Airtable retry and risk a duplicate send.
  await sendFeedbackReady(
    submission.customerEmail,
    submission.feedbackVideoUrl,
    submission.playerName,
  );

  // Best-effort: stamp the row so a re-fire won't double-send. Never fatal — if
  // the column is missing, log and move on rather than 500 (a 500 would make
  // Airtable retry and re-send the email).
  try {
    await updateSubmission(submission.id, {
      feedbackEmailedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(
      "[airtable webhook] could not stamp Feedback Emailed At (add the column to make sends idempotent):",
      err,
    );
  }

  return new Response("ok", { status: 200 });
}

/** Constant-time check of the shared secret header. */
function isAuthorized(request: Request): boolean {
  const provided = request.headers.get("x-webhook-secret") ?? "";
  const expected = env.airtableWebhookSecret;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
