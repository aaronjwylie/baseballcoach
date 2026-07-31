import { NextResponse } from "next/server";
import { getSubmission } from "@/domains/submission";
import { storage } from "@/shared/storage";
import { readSession } from "@/shared/auth";

/**
 * Download a submission's feedback file.
 *
 * **Public once complete** — the customer isn't logged in and reaches this from
 * their status lookup (the id is an unguessable uuid, the same URL-as-capability
 * trade-off the status page makes). **Operators can download at any status**, so
 * Yuta can review the coach's material while it's still `awaiting_approval`,
 * before the customer is ever emailed a link.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const submission = await getSubmission(id);
  const isOperator = !!(await readSession());

  if (
    !submission ||
    !submission.feedbackUrl ||
    (!isOperator && submission.status !== "complete")
  ) {
    return new Response("Not found", { status: 404 });
  }

  const opened = await storage.open(submission.feedbackUrl);
  if (opened.redirectTo) return NextResponse.redirect(opened.redirectTo);

  return new Response(opened.stream, {
    headers: {
      "Content-Type": opened.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${opened.filename ?? "feedback"}"`,
      ...(opened.size ? { "Content-Length": String(opened.size) } : {}),
    },
  });
}
