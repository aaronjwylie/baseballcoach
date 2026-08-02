/**
 * The payoff email — the coach's breakdown is ready.
 *
 * Sent when Yuta approves a submission (`approveAndComplete`). By this point the
 * customer left the site days ago, so email is the only way to reach them. The
 * link is the status page rather than a single file, because a review may now be
 * several files: the customer looks up their email and downloads each one.
 */
import { emailShell, sendEmail } from "@/shared/email";
import { site } from "@/shared/config/site";

export function sendFeedbackReady(
  to: string,
  feedbackUrl: string,
  playerName?: string,
) {
  return sendEmail({
    to,
    subject: `${site.name} — your coaching feedback is ready`,
    html: emailShell(
      "Your feedback is ready 🎬",
      `<p>Your coach has finished reviewing${playerName ? ` ${playerName}'s` : " your"} video. Tap below to download the full breakdown — this link is private to you.</p>`,
      { label: "See your feedback", url: feedbackUrl },
    ),
  });
}

/**
 * The access code for the status-page path: a customer who lost the link above
 * can prove they own the inbox by entering their email on `/status` and reading
 * back this code. Same guarantee as the link — you must control the inbox.
 */
export function sendFeedbackViewCode(to: string, code: string) {
  return sendEmail({
    to,
    subject: `${code} is your ${site.name} feedback access code`,
    html: emailShell(
      "Your feedback access code",
      `<p>Enter this code on the status page to view your coaching feedback:</p>
       <p style="margin:24px 0;font-size:34px;font-weight:700;letter-spacing:0.18em;color:#161616;">${code}</p>
       <p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
    ),
  });
}
