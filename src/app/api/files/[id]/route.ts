import { NextResponse } from "next/server";
import { getSession } from "@/domains/operator";
import { getSubmissionFile, isIntake } from "@/domains/submission";
import { noteCoachCollected } from "@/domains/operator";
import { storage } from "@/shared/storage";

// Private blobs stream through this route rather than redirecting, so a large
// clip on a slow connection needs room to finish (Hobby caps this at 60s).
export const maxDuration = 60;

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
 *
 * **It is also where step 9 is observed.** A download is the only evidence we
 * ever get that the coach actually has the work — there is no "I've started"
 * button, and asking for one would be a button nobody presses. So the first time
 * the assigned coach collects an intake file, the submission moves to
 * `in_review` and the admin is told the hand-off closed.
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

  /*
    Step 9, observed rather than declared.

    Gated on it being *the assigned coach*: an admin opening the same file is
    checking on the work, not starting it, and letting that count would make
    `in_review` mean nothing again. Intake only — a coach re-reading their own
    response isn't a pick-up.

    Not awaited. The stamp and its email must never be the reason a download
    fails, and the customer of this route is a coach waiting on bytes.
  */
  if (session.role === "coach" && isIntake(file)) {
    void noteCoachCollected(file.submissionId, session.operatorId);
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
