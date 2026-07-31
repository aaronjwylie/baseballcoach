/**
 * The one email the payment domain sends: the receipt.
 *
 * It changed shape with the flow. It used to say "we took your money, now go
 * upload" — payment came first, so the message was an instruction. Payment is
 * now last, so by the time this sends the files are already in and the message
 * is a confirmation: what was charged, what we received, and what happens next.
 *
 * Fired once, gated on `justPaid`, so a redelivered webhook can't send a second.
 */
import { emailShell, sendEmail } from "@/shared/email";
import { site } from "@/shared/config/site";
import { formatFileSize, type SubmissionFile } from "@/domains/submission";

export interface ReceiptDetails {
  playerName: string;
  amountCents: number;
  currency: string;
  files: SubmissionFile[];
  statusUrl: string;
}

export function sendSubmissionReceipt(to: string, details: ReceiptDetails) {
  const { playerName, amountCents, currency, files, statusUrl } = details;

  return sendEmail({
    to,
    subject: `${site.name} — submission confirmed for ${playerName}`,
    html: emailShell(
      "You're all set ✅",
      `<p>Thanks — your submission for <strong>${escapeHtml(playerName)}</strong> is in and paid for.</p>

       <h2 style="margin:28px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:0.06em;color:#818184;">Receipt</h2>
       <table style="width:100%;border-collapse:collapse;font-size:15px;">
         <tr>
           <td style="padding:6px 0;color:#4f4f52;">Video review</td>
           <td style="padding:6px 0;text-align:right;color:#161616;font-weight:600;">${formatMoney(amountCents, currency)}</td>
         </tr>
         <tr>
           <td style="padding:6px 0;border-top:1px solid #e3e3e3;color:#161616;font-weight:600;">Total paid</td>
           <td style="padding:6px 0;border-top:1px solid #e3e3e3;text-align:right;color:#161616;font-weight:600;">${formatMoney(amountCents, currency)}</td>
         </tr>
       </table>

       <h2 style="margin:28px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:0.06em;color:#818184;">Files received (${files.length})</h2>
       ${fileList(files)}

       <p style="margin-top:28px;">A coach will review it and send a personal video walkthrough within <strong>${site.turnaround}</strong>. We'll email you the moment it's ready.</p>`,
      { label: "Check your status", url: statusUrl },
    ),
  });
}

function fileList(files: SubmissionFile[]): string {
  if (files.length === 0) {
    return `<p style="color:#818184;">No files were attached.</p>`;
  }

  const rows = files
    .map(
      (file) =>
        `<tr>
           <td style="padding:6px 0;color:#4f4f52;">${escapeHtml(file.filename)}</td>
           <td style="padding:6px 0;text-align:right;color:#818184;white-space:nowrap;">${formatFileSize(file.sizeBytes)}</td>
         </tr>`,
    )
    .join("");

  return `<table style="width:100%;border-collapse:collapse;font-size:15px;">${rows}</table>`;
}

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * Filenames and player names come from the customer and land in an HTML email.
 * Escaping them is the difference between a receipt and an injection vector.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
