import { NextResponse } from "next/server";
import { getSession } from "@/domains/operator";
import { getCoachByOperatorId } from "@/domains/coach";
import { getSubmission } from "@/domains/submission";
import { saveFeedbackFile } from "@/domains/feedback";

/**
 * The **development** feedback path: the bytes come through us onto local disk,
 * because there's no Blob store. Records one `feedback` file and returns it; it
 * does **not** advance the submission — the coach hands the set to the admin with a
 * separate "send for approval" action. A coach may only deliver for their own
 * assignments; the admin may deliver for anyone.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const submissionId = url.searchParams.get("submission")?.trim();
  const filename = url.searchParams.get("filename")?.trim() || "feedback";
  if (!submissionId) {
    return NextResponse.json({ error: "Missing submission." }, { status: 400 });
  }

  const submission = await getSubmission(submissionId);
  if (!submission) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (session.role !== "admin") {
    const coach = await getCoachByOperatorId(session.operatorId);
    if (!coach || submission.assignedCoachId !== coach.id) {
      return NextResponse.json({ error: "Not your submission." }, { status: 403 });
    }
  }

  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: "The file was empty." }, { status: 400 });
    }
    const contentType =
      request.headers.get("content-type") || "application/octet-stream";
    const file = await saveFeedbackFile(submissionId, filename, bytes, contentType);
    return NextResponse.json({
      file: { id: file.id, filename: file.filename, sizeBytes: file.sizeBytes },
    });
  } catch (err) {
    console.error("[feedback upload] failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 502 },
    );
  }
}
