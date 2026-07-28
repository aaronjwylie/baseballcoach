/**
 * The one email the payment domain sends: "we took your money, here's what to
 * do next." Fired once, from the Stripe webhook, on first fulfillment.
 */
import { emailShell, sendEmail } from "@/shared/email";
import { site } from "@/shared/config/site";

export function sendPaymentConfirmation(to: string, uploadUrl: string) {
  return sendEmail({
    to,
    subject: `${site.name} — payment received, upload your video`,
    html: emailShell(
      "Payment received 🎉",
      `<p>Thanks for your order. The last step is to upload the video you'd like reviewed.</p>
       <p>If you didn't get to the upload page, or want to come back to it, use the button below.</p>`,
      { label: "Upload your video", url: uploadUrl },
    ),
  });
}
