import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/shared/config/env";
import { noteEmailOutcome, type EmailOutcome } from "@/domains/submission";

/**
 * Resend's delivery webhook — what actually became of an email.
 *
 * The send path can only ever claim "Resend accepted it". Everything after —
 * delivered, bounced, marked as spam — arrives here seconds later, and a bounce
 * on the verification code is the failure that otherwise looks exactly like a
 * customer being slow to check their inbox.
 *
 * **The raw body is required.** Like Stripe's, the signature is computed over
 * the exact bytes sent, so parsing first breaks it.
 *
 * Resend signs with Svix. Verifying it by hand rather than adding the `svix`
 * package: it's an HMAC over three concatenated values, and a dependency that
 * exists to do one `createHmac` is a dependency to keep patched forever.
 */

/** The Resend events worth recording. Anything else is a deliberate no-op. */
const OUTCOME: Record<string, EmailOutcome> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};

/**
 * Verify a Svix signature over the raw body.
 *
 * The signed payload is `${id}.${timestamp}.${body}`, HMAC-SHA256 with the
 * secret's base64 half, compared base64. The header can carry several
 * space-separated signatures during a secret rotation, so any match is a pass.
 *
 * Timing-safe, and it rejects an old timestamp: without that, a captured
 * delivery could be replayed indefinitely to keep writing to a submission's
 * trail.
 */
function verifySvix(
  raw: string,
  headers: Headers,
  secret: string,
): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  // `whsec_<base64>` — the key is the decoded half.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${raw}`)
    .digest();

  return signatures.split(" ").some((entry) => {
    // Each entry is `v1,<base64>`.
    const value = entry.split(",")[1];
    if (!value) return false;
    const given = Buffer.from(value, "base64");
    return (
      given.length === expected.length && timingSafeEqual(given, expected)
    );
  });
}

export async function POST(request: Request) {
  const secret = env.resendWebhookSecret;
  if (!secret) {
    // Refuse rather than trust. Losing delivery tracking is a degraded trail;
    // an open endpoint that writes to it is a forgeable one.
    console.error("[resend webhook] RESEND_WEBHOOK_SECRET unset — refusing");
    return new Response("Not configured", { status: 503 });
  }

  const raw = await request.text();
  if (!verifySvix(raw, request.headers, secret)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const outcome = event.type ? OUTCOME[event.type] : undefined;
  const messageId = event.data?.email_id;
  if (!outcome || !messageId) {
    // An event we don't act on, or a test delivery with no id. Acknowledged, so
    // Resend doesn't retry something we will never handle.
    return new Response(null, { status: 204 });
  }

  try {
    const origin = await noteEmailOutcome(messageId, outcome);
    if (!origin) {
      // Sent before this existed, or not ours. Nothing to attach it to.
      return new Response(null, { status: 204 });
    }

    if (outcome === "bounced") {
      // Logged loudly: a bounce is the one outcome somebody may need to chase,
      // and the trail alone is only seen by whoever opens the row.
      console.warn(
        `[resend webhook] bounced: ${origin.label} for ${origin.submissionId}`,
      );
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    // 500 so Resend retries — recording an outcome twice is harmless, since
    // each attempt appends a row and the trail is a history either way.
    console.error("[resend webhook] failed:", err);
    return new Response("Error", { status: 500 });
  }
}

// node:crypto — not the edge runtime.
export const runtime = "nodejs";
