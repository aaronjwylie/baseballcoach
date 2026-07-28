import { NextResponse } from "next/server";
import { parseSubmissionInput } from "@/domains/submission";
import { createCheckoutSession } from "@/domains/payment";

/**
 * Start checkout for a single video review.
 *
 * The route owns HTTP — parsing, validation, status codes. What it means to
 * charge for a review lives in the payment domain.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
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
    const url = await createCheckoutSession(parsed.value);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[checkout] Stripe session create failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }
}
