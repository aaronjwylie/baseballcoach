/**
 * The payoff email — the coach's breakdown is ready.
 *
 * Sent from the Airtable automation webhook when Yuta sets Status = Complete.
 * By this point the customer left the site days ago, so email is the only way
 * to reach them (they can also poll /status).
 */
import { emailShell, sendEmail } from "@/shared/email";
import { site } from "@/shared/config/site";

export function sendFeedbackReady(
  to: string,
  feedbackVideoUrl: string,
  playerName?: string,
) {
  return sendEmail({
    to,
    subject: `${site.name} — your coaching feedback is ready`,
    html: emailShell(
      "Your feedback is ready 🎬",
      `<p>Your coach has finished reviewing${playerName ? ` ${playerName}'s` : " your"} video. Watch the full breakdown below.</p>`,
      { label: "Watch your feedback", url: feedbackVideoUrl },
    ),
  });
}
