/**
 * "Your video arrived." Sent from the Mux webhook on the first transition out
 * of Awaiting Upload — the moment we can honestly say we have the footage.
 */
import { emailShell, sendEmail } from "@/shared/email";
import { site } from "@/shared/config/site";

export function sendVideoReceived(to: string, playerName?: string) {
  return sendEmail({
    to,
    subject: `${site.name} — we've got your video`,
    html: emailShell(
      "Your video is in ✅",
      `<p>We've received the video${playerName ? ` for ${playerName}` : ""} and it's queued for review.</p>
       <p>One of our coaches will break it down and send a personal walkthrough within <strong>${site.turnaroundDays}</strong>. We'll email you the moment it's ready.</p>`,
    ),
  });
}
