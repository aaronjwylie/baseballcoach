import { NextResponse } from "next/server";
import { ensureSubmission, getSucceededPaymentIntent } from "@/domains/payment";
import { updateSubmission } from "@/domains/submission";
import { createDirectUpload } from "@/domains/upload";

/**
 * Issue a Mux direct-upload URL for a paid submission.
 *
 * Gated on a Stripe-verified succeeded PaymentIntent, so an unpaid or forged
 * reference can never mint an upload URL.
 */
export async function POST(request: Request) {
  let body: { payment_intent?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const paymentIntentId = body.payment_intent?.trim();
  if (!paymentIntentId) {
    return NextResponse.json({ error: "Missing payment reference." }, { status: 400 });
  }

  const intent = await getSucceededPaymentIntent(paymentIntentId);
  if (intent === null) {
    return NextResponse.json(
      { error: "We couldn't find that payment." },
      { status: 404 },
    );
  }
  if (intent === "unpaid") {
    return NextResponse.json(
      { error: "This payment hasn't completed." },
      { status: 402 },
    );
  }

  try {
    const { submission } = await ensureSubmission(intent);
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
