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
  statusUrl: string,
  playerName?: string,
) {
  return sendEmail({
    to,
    subject: `${site.name} — your coaching feedback is ready`,
    html: emailShell(
      "Your feedback is ready 🎬",
      `<p>Your coach has finished reviewing${playerName ? ` ${playerName}'s` : " your"} video. Look up your email below to download the full breakdown.</p>`,
      { label: "See your feedback", url: statusUrl },
    ),
  });
}
