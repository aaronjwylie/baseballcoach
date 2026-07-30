/**
 * The brand shell every transactional email wears.
 *
 * The three messages are genuinely different and live in their own domains;
 * what they share — the header, the type scale, the CTA button, the footer — is
 * written once, here. Symmetry built in rather than hoped for (principle #8).
 *
 * Inline styles and table-free markup are deliberate: email clients strip
 * <style> blocks and Gmail clips long messages, so these stay short and link out.
 *
 * The hex values mirror the tokens in `app/globals.css` — email can't read CSS
 * variables, so this is the one place a colour is written twice. Change one,
 * change the other, or the emails drift from the site.
 */
import { site } from "@/shared/config/site";

export interface EmailCta {
  label: string;
  url: string;
}

export function emailShell(
  heading: string,
  body: string,
  cta?: EmailCta,
): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f2f2f2;padding:32px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;">
      <div style="background:#161616;padding:24px 32px;">
        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">${site.name}</span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:22px;color:#161616;">${heading}</h1>
        <div style="font-size:15px;line-height:1.6;color:#4f4f52;">${body}</div>
        ${
          cta
            ? `<div style="margin-top:28px;"><a href="${cta.url}" style="display:inline-block;background:#161616;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px;font-size:15px;">${cta.label}</a></div>`
            : ""
        }
      </div>
      <div style="padding:20px 32px;background:#f2f2f2;font-size:12px;color:#818184;">
        ${site.name} · This is an automated message about your coaching submission.
      </div>
    </div>
  </div>`;
}
