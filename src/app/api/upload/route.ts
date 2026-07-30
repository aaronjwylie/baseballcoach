import { NextResponse } from "next/server";
import { ensureSubmission, getSucceededPaymentIntent } from "@/domains/payment";
import { storeVideo, sendVideoReceived } from "@/domains/upload";

/**
 * Receive a customer's video and attach it to their paid submission.
 *
 * Gated on a Stripe-verified succeeded PaymentIntent, so an unpaid or forged
 * reference can never store a file. The file is the raw request body; the
 * payment id and filename ride on the query string.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const paymentIntentId = url.searchParams.get("payment_intent")?.trim();
  const filename = url.searchParams.get("filename")?.trim() || "video";

  if (!paymentIntentId) {
    return NextResponse.json({ error: "Missing payment reference." }, { status: 400 });
  }

  const intent = await getSucceededPaymentIntent(paymentIntentId);
  if (intent === null) {
    return NextResponse.json({ error: "We couldn't find that payment." }, { status: 404 });
  }
  if (intent === "unpaid") {
    return NextResponse.json({ error: "This payment hasn't completed." }, { status: 402 });
  }

  try {
    const { submission } = await ensureSubmission(intent);
    const firstUpload = submission.status === "awaiting_upload";

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: "The file was empty." }, { status: 400 });
    }
    const contentType =
      request.headers.get("content-type") || "application/octet-stream";

    const updated = await storeVideo(submission.id, filename, bytes, contentType);

    // Only on the first upload, so a re-upload doesn't re-send the email.
    if (firstUpload && updated.customerEmail) {
      await sendVideoReceived(updated.customerEmail, updated.playerName);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 502 },
    );
  }
}
