import { NextResponse } from "next/server";
import { getSubmission } from "@/domains/submission";
import { storage } from "@/shared/storage";

/**
 * Download a submission's feedback file. **Public**, but only once the review
 * is complete — the customer isn't logged in, and reaches this from their
 * status lookup. The id is an unguessable uuid, the same URL-as-capability
 * trade-off the status page already makes.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const submission = await getSubmission(id);

  if (
    !submission ||
    submission.status !== "complete" ||
    !submission.feedbackUrl
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
