/**
 * The one email this domain sends: the code itself.
 *
 * Unlike every other message in the app this one is **time-critical** — the
 * customer is sitting on the verification step waiting for it. It is still
 * best-effort at the transport level (ADR 004: a send failure logs and never
 * throws), but the UI tells them plainly when it couldn't be sent rather than
 * leaving them staring at an empty inbox.
 */
import { emailShell, sendEmail } from "@/shared/email";
import { site } from "@/shared/config/site";
import { CODE_TTL_MINUTES } from "../model/verification";

/**
 * Returns whether the code was accepted for delivery.
 *
 * The one message a customer is **blocked** on, so unlike every other send in
 * the app the caller must check: advancing someone to "enter the code" when no
 * code is coming is a dead end they cannot get out of, and it looks identical to
 * a slow inbox.
 */
export function sendVerificationCode(to: string, code: string) {
  return sendEmail({
    to,
    subject: `${code} is your ${site.name} verification code`,
    html: emailShell(
      "Your verification code",
      `<p>Enter this code to carry on with your submission:</p>
       <p style="margin:24px 0;font-size:34px;font-weight:700;letter-spacing:0.18em;color:#161616;">${code}</p>
       <p>It expires in ${CODE_TTL_MINUTES} minutes. If you didn't start a submission, you can ignore this email — nothing has been charged.</p>`,
    ),
  });
}
