/**
 * Transactional email transport (Resend REST API).
 *
 * Sending is **best-effort**: every send is wrapped so a failure logs but never
 * throws into a webhook handler or a portal action. Stripe retries on any non-2xx,
 * so a throwing send would turn a degraded email provider into a retry storm
 * against a payment that already succeeded. See ADR 004.
 *
 * The `from` address is `EMAIL_FROM` (the verified Resend domain in prod), set
 * once in env — callers never pass it.
 *
 * If RESEND_API_KEY is unset, sends are skipped with a log line — absent reads
 * as absent (principle #10), never a fake success.
 */
import { env } from "@/shared/config/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({
  to,
  subject,
  html,
}: EmailMessage): Promise<void> {
  const apiKey = env.resendApiKey;
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY unset — skipping email to ${to}: ${subject}`,
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
    });
    if (!res.ok) {
      console.error(`[email] Resend ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}
