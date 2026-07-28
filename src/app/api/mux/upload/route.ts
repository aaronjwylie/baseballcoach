import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { mux } from "@/lib/mux";
import { env } from "@/lib/env";
import { ensureSubmission } from "@/lib/fulfillment";
import { updateSubmission } from "@/integrations/airtable/submissions";

/**
 * Creates a Mux direct-upload URL for a paid submission and returns it to the
 * browser uploader. Gated on a paid Stripe session so we never mint upload
 * URLs for unpaid or forged sessions. The submission record ID is stored as
 * the asset `passthrough` so the Mux webhook can find the row later.
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
    return NextResponse.json(
      { error: "Missing session id." },
      { status: 400 },
    );
  }

  // Verify the session exists and is paid before doing any work.
  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json(
      { error: "We couldn't find that checkout session." },
      { status: 404 },
    );
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "This session hasn't been paid." },
      { status: 402 },
    );
  }

  try {
    const { submission } = await ensureSubmission(session);

    const upload = await mux().video.uploads.create({
      cors_origin: env.siteUrl,
      timeout: 3600,
      new_asset_settings: {
        playback_policies: ["public"],
        // Ties the resulting asset back to this submission row (ADR 002).
        passthrough: submission.id,
      },
    });

    // Record the upload id so the webhook has a fallback route to this row.
    await updateSubmission(submission.id, { muxUploadId: upload.id });

    if (!upload.url) {
      throw new Error("Mux did not return an upload URL");
    }
    return NextResponse.json({ url: upload.url });
  } catch (err) {
    console.error("[mux upload] failed:", err);
    return NextResponse.json(
      { error: "Could not prepare the upload. Please try again." },
      { status: 502 },
    );
  }
}
