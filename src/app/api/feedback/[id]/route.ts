import { NextResponse } from "next/server";
import { getSubmission, getSubmissionFile } from "@/domains/submission";
import { storage } from "@/shared/storage";
import { readSession } from "@/shared/auth";

// Private blobs stream through this route rather than redirecting, so a large
// feedback video on a slow connection needs room to finish (Hobby caps at 60s).
export const maxDuration = 60;

/**
 * Download one of a submission's feedback files, by the file's own id.
 *
 * **Public once the submission is complete** — the customer isn't logged in and
 * reaches this from their status lookup (the id is an unguessable uuid, the same
 * URL-as-capability trade-off the status page makes). **Operators can download
 * at any status**, so Yuta can review the coach's material while it's still
 * `awaiting_approval`, before the customer is ever emailed.
 *
 * The id must name a `feedback` file — a customer upload downloaded through here
 * would sidestep the operator-only `/api/files/[id]` gate.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const file = await getSubmissionFile(id);
  if (!file || file.kind !== "feedback" || !file.fileUrl) {
    return new Response("Not found", { status: 404 });
  }

  const isOperator = !!(await readSession());
  if (!isOperator) {
    const submission = await getSubmission(file.submissionId);
    if (!submission || submission.status !== "complete") {
      return new Response("Not found", { status: 404 });
    }
  }

  const opened = await storage.open(file.fileUrl);
  if (opened.redirectTo) return NextResponse.redirect(opened.redirectTo);

  return new Response(opened.stream, {
    headers: {
      "Content-Type": opened.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      ...(opened.size ? { "Content-Length": String(opened.size) } : {}),
    },
  });
}
