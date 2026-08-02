/**
 * Notify a coach that a submission has been assigned to them.
 *
 * An operator email, not a customer one, but best-effort like the rest: a mail
 * failure logs and never blocks the hand-off (ADR 004). It carries everything
 * the coach needs to start — the customer's details and a download link per
 * file — so the review can begin from the inbox. The links resolve through the
 * operator-gated `/api/files/[id]`, so the coach signs in once (the CTA) and the
 * links work for the session.
 *
 * Customer- and admin-supplied text (notes, filenames, names) is HTML-escaped —
 * this email interpolates free text a customer typed, which the customer-facing
 * emails never did.
 */
import { emailShell, sendEmail } from "@/shared/email";
import { site } from "@/shared/config/site";
import { env } from "@/shared/config/env";
import { formatFileSize, type Submission, type SubmissionFile } from "@/domains/submission";

function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

interface AssignmentEmailInput {
  to: string;
  coachName: string;
  submission: Submission;
  files: SubmissionFile[];
}

/** Pure builder — the subject + HTML, separated from sending so it's testable. */
export function buildAssignmentEmail(
  opts: AssignmentEmailInput,
): { subject: string; html: string } {
  const { coachName, submission, files } = opts;

  const details = [
    `<strong>Player:</strong> ${esc(submission.playerName)}${
      submission.playerAge ? `, age ${submission.playerAge}` : ""
    }`,
    submission.focus ? `<strong>Focus:</strong> ${esc(submission.focus)}` : null,
    `<strong>Customer:</strong> ${esc(submission.customerEmail)}`,
  ]
    .filter(Boolean)
    .map((line) => `<p style="margin:4px 0">${line}</p>`)
    .join("");

  const notes = submission.customerNotes
    ? `<p style="margin:12px 0 4px"><strong>Notes from the customer</strong></p>
       <p style="margin:0">${esc(submission.customerNotes).replace(/\n/g, "<br>")}</p>`
    : "";

  const available = files.filter((f) => f.fileUrl);
  const filesHtml = available.length
    ? `<p style="margin:16px 0 4px"><strong>Files to download</strong></p>
       <ul style="margin:0;padding-left:20px">${available
         .map(
           (f) =>
             `<li><a href="${env.siteUrl}/api/files/${f.id}">${esc(f.filename)}</a> — ${formatFileSize(f.sizeBytes)}</li>`,
         )
         .join("")}</ul>`
    : `<p style="margin:16px 0 4px"><strong>Files</strong></p>
       <p style="margin:0">No files are attached — they may have been removed by the retention sweep.</p>`;

  return {
    subject: `${site.name} — a new review is assigned to you`,
    html: emailShell(
      "You have a new review",
      `<p>Hi ${esc(coachName)}, a submission is ready for your feedback.</p>
       ${details}
       ${notes}
       ${filesHtml}
       <p style="margin:16px 0 0">Sign in to the coach portal to upload your breakdown when it's ready.</p>`,
      { label: "Open the coach portal", url: `${env.siteUrl}/coach` },
    ),
  };
}

export function sendAssignmentEmail(opts: AssignmentEmailInput) {
  const { subject, html } = buildAssignmentEmail(opts);
  return sendEmail({ to: opts.to, subject, html });
}

/**
 * ④ — the coach has collected the files. To Yuta.
 *
 * The hand-off is the one step in the pipeline that waits on a person outside
 * the building, and until this exists the only way to know whether it landed is
 * to ask. A submission sitting in `sent_to_coach` for three days is the single
 * most useful thing the queue can surface; this is the message that says it
 * stopped sitting there.
 *
 * Best-effort — the status already moved, and a missed notification is a smaller
 * problem than a failed download.
 */
export function sendCoachCollectedEmail(opts: {
  to: string[];
  coachName: string;
  playerName: string;
  submissionUrl: string;
}) {
  // Nobody to tell — an install with no admin row. Reported as a
  // non-send rather than thrown, so a webhook never fails over it.
  if (opts.to.length === 0) return Promise.resolve({ ok: false });
  const coach = esc(opts.coachName);
  const player = esc(opts.playerName);
  return sendEmail({
    to: opts.to.join(", "),
    subject: `${site.name} — ${opts.coachName} picked up ${opts.playerName}`,
    html: emailShell(
      "The coach has the files",
      `<p><strong>${coach}</strong> has downloaded the files for <strong>${player}</strong>, so the review is under way.</p>
       <p>Nothing to do — this is just the hand-off closing.</p>`,
      { label: "Open the queue", url: opts.submissionUrl },
    ),
  });
}
