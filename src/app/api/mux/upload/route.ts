import { NextResponse } from "next/server";
import { ensureSubmission, getPaidSession } from "@/domains/payment";
import { updateSubmission } from "@/domains/submission";
import { createDirectUpload } from "@/domains/upload";

/**
 * Issue a Mux direct-upload URL for a paid submission.
 *
 * Gated on a Stripe-verified paid session, so an unpaid or forged session can
 * never mint an upload URL.
 */
export async function POST(request: Request) {
  let body: { session_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id." }, { status: 400 });
  }

  const session = await getPaidSession(sessionId);
  if (session === null) {
    return NextResponse.json(
      { error: "We couldn't find that checkout session." },
      { status: 404 },
    );
  }
  if (session === "unpaid") {
    return NextResponse.json(
      { error: "This session hasn't been paid." },
      { status: 402 },
    );
  }

  try {
    const { submission } = await ensureSubmission(session);
    const { uploadUrl, uploadId } = await createDirectUpload(submission.id);

    // Record the upload id so the Mux webhook has a fallback route to this row.
    await updateSubmission(submission.id, { muxUploadId: uploadId });

    return NextResponse.json({ url: uploadUrl });
  } catch (err) {
    console.error("[mux upload] failed:", err);
    return NextResponse.json(
      { error: "Could not prepare the upload. Please try again." },
      { status: 502 },
    );
  }
}
