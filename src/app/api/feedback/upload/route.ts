import { NextResponse } from "next/server";
import { getSession } from "@/domains/account";
import { getCoachByUserId } from "@/domains/coach";
import { getSubmission } from "@/domains/submission";
import { storeFeedback } from "@/domains/feedback";

/**
 * A coach delivers feedback for a submission: stores the file and parks it at
 * `awaiting_approval` for Yuta to review before the customer is emailed. A coach
 * may only deliver for their own assignments; the admin may deliver for anyone.
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
    const coach = await getCoachByUserId(session.userId);
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
    await storeFeedback(submissionId, filename, bytes, contentType);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback upload] failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 502 },
    );
  }
}
