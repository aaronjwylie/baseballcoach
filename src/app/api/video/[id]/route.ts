import { NextResponse } from "next/server";
import { getSession } from "@/domains/account";
import { getSubmission } from "@/domains/submission";
import { storage } from "@/shared/storage";

/**
 * Download a submission's customer video. **Operator-only** — a coach or the
 * admin, checked here rather than trusting the proxy. Streams from local disk
 * in dev, redirects to the Blob URL in prod.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const submission = await getSubmission(id);
  if (!submission?.videoUrl) return new Response("Not found", { status: 404 });

  const opened = await storage.open(submission.videoUrl);
  if (opened.redirectTo) return NextResponse.redirect(opened.redirectTo);

  return new Response(opened.stream, {
    headers: {
      "Content-Type": opened.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${opened.filename ?? "video"}"`,
      ...(opened.size ? { "Content-Length": String(opened.size) } : {}),
    },
  });
}
