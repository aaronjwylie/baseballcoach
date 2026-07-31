import { NextResponse } from "next/server";
import { getSession } from "@/domains/account";
import { getSubmissionFile } from "@/domains/submission";
import { storage } from "@/shared/storage";

/**
 * Download one of a customer's uploaded files. **Operator-only** — a coach or
 * the admin, checked here rather than trusting the proxy.
 *
 * Replaced `/api/video/[id]`, which was keyed on the submission because a
 * submission had exactly one video. It now has several files, so the id in the
 * path is the file's.
 *
 * Streams from local disk in dev, redirects to the Blob URL in prod. A file the
 * retention sweep has already cleared has no locator left, which reads as 410
 * rather than 404: it existed, and it's gone on purpose.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const file = await getSubmissionFile(id);
  if (!file) return new Response("Not found", { status: 404 });
  if (!file.fileUrl) {
    return new Response("This file has been deleted under the retention policy.", {
      status: 410,
    });
  }

  const opened = await storage.open(file.fileUrl);
  if (opened.redirectTo) return NextResponse.redirect(opened.redirectTo);

  return new Response(opened.stream, {
    headers: {
      "Content-Type": opened.contentType ?? file.contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.filename)}"`,
      ...(opened.size ? { "Content-Length": String(opened.size) } : {}),
    },
  });
}
