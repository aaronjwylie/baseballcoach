import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/domains/account";
import { getCoachByUserId } from "@/domains/coach";
import { getSubmission } from "@/domains/submission";
import { recordFeedbackFile } from "@/domains/feedback";

/**
 * Record a feedback file the coach's browser uploaded straight to Blob — the
 * counterpart to `/api/upload/complete`.
 *
 * The browser reports where the object landed, so none of it is trusted: the
 * operator gate runs again, and the submission is taken from the pathname
 * (`submissions/<id>/feedback/…`), never from a field the browser could point
 * anywhere. Ownership is re-checked before the row is written.
 */
const bodySchema = z.object({
  fileUrl: z.string().url().max(2048),
  pathname: z.string().min(1).max(1024),
  filename: z.string().min(1).max(255),
  contentType: z.string().max(255).optional(),
  sizeBytes: z.number().int().positive(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload details." }, { status: 400 });
  }

  const match = parsed.data.pathname.match(/^submissions\/([^/]+)\/feedback\//);
  if (!match) {
    return NextResponse.json(
      { error: "That upload isn't a feedback file." },
      { status: 400 },
    );
  }
  const submissionId = match[1];

  const submission = await getSubmission(submissionId);
  if (!submission) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (session.role !== "admin") {
    const coach = await getCoachByUserId(session.userId);
    if (!coach || submission.assignedCoachId !== coach.id) {
      return NextResponse.json({ error: "Not your submission." }, { status: 403 });
    }
  }

  try {
    const file = await recordFeedbackFile(submissionId, {
      filename: parsed.data.filename,
      contentType: parsed.data.contentType ?? "application/octet-stream",
      sizeBytes: parsed.data.sizeBytes,
      fileUrl: parsed.data.fileUrl,
    });
    return NextResponse.json({
      file: { id: file.id, filename: file.filename, sizeBytes: file.sizeBytes },
    });
  } catch (err) {
    console.error("[feedback/complete] failed:", err);
    return NextResponse.json(
      { error: "We couldn't save that file. Please try again." },
      { status: 502 },
    );
  }
}
