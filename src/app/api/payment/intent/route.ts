import { NextResponse } from "next/server";
import { parseSubmissionInput } from "@/domains/submission";
import { createPaymentIntent } from "@/domains/payment";

/**
 * Create a PaymentIntent for one video review.
 *
 * The route owns HTTP — parsing, validation, status codes. What it means to
 * charge for a review lives in the payment domain.
 *
 * Returns a client secret, which is safe to hand to the browser: it authorizes
 * confirming *this one* payment and nothing else.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = parseSubmissionInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const intent = await createPaymentIntent(parsed.value);
    return NextResponse.json(intent);
  } catch (err) {
    console.error("[payment] intent create failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }
}
