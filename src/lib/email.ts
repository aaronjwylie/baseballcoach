/**
 * Transactional email via Resend's REST API.
 *
 * Email is best-effort: every send is wrapped so a failure logs but never
 * throws into a webhook handler (which Stripe/Mux would otherwise retry).
 * If RESEND_API_KEY is unset, sends are skipped with a log line.
 */
import { env } from "./env";
import { site } from "./site";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

async function send({ to, subject, html }: SendArgs): Promise<void> {
  const apiKey = env.resendApiKey;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY unset — skipping email to ${to}: ${subject}`);
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

function shell(heading: string, body: string, cta?: { label: string; url: string }): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f5f7;padding:32px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#0f172a;padding:24px 32px;">
        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${site.name}</span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${heading}</h1>
        <div style="font-size:15px;line-height:1.6;color:#334155;">${body}</div>
        ${
          cta
            ? `<div style="margin-top:28px;"><a href="${cta.url}" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px;font-size:15px;">${cta.label}</a></div>`
            : ""
        }
      </div>
      <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#94a3b8;">
        ${site.name} · This is an automated message about your coaching submission.
      </div>
    </div>
  </div>`;
}

export function sendPaymentConfirmation(to: string, uploadUrl: string) {
  return send({
    to,
    subject: `${site.name} — payment received, upload your video`,
    html: shell(
      "Payment received 🎉",
      `<p>Thanks for your order. The last step is to upload the video you'd like reviewed.</p>
       <p>If you didn't get to the upload page, or want to come back to it, use the button below.</p>`,
      { label: "Upload your video", url: uploadUrl },
    ),
  });
}

export function sendUploadReceived(to: string, playerName?: string) {
  return send({
    to,
    subject: `${site.name} — we've got your video`,
    html: shell(
      "Your video is in ✅",
      `<p>We've received the video${playerName ? ` for ${playerName}` : ""} and it's queued for review.</p>
       <p>One of our coaches will break it down and send a personal walkthrough within <strong>${site.turnaroundDays}</strong>. We'll email you the moment it's ready.</p>`,
    ),
  });
}

export function sendFeedbackReady(to: string, feedbackLink: string, playerName?: string) {
  return send({
    to,
    subject: `${site.name} — your coaching feedback is ready`,
    html: shell(
      "Your feedback is ready 🎬",
      `<p>Your coach has finished reviewing${playerName ? ` ${playerName}'s` : " your"} video. Watch the full breakdown below.</p>`,
      { label: "Watch your feedback", url: feedbackLink },
    ),
  });
}
