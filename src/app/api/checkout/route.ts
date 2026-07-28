import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { site } from "@/lib/site";
import { parseSubmissionInput } from "@/lib/submission-input";

/**
 * Creates a Stripe Checkout session for a single video review and returns its
 * hosted URL. The player info is validated here and carried on the session's
 * `metadata` so the webhook can create a complete Airtable row after payment.
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
  const { customerEmail, playerName, playerAge, focus, customerNotes } =
    parsed.value;

  // Prefer a pre-created Price if configured; otherwise price inline from
  // site.ts so the client doesn't need to set up a Stripe Product first.
  const lineItem: import("stripe").Stripe.Checkout.SessionCreateParams.LineItem =
    env.stripePriceId
      ? { price: env.stripePriceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: site.price.currency,
            unit_amount: site.price.amountCents,
            product_data: {
              name: `${site.name} — Single Video Review`,
              description: `Personal coaching breakdown for ${playerName}.`,
            },
          },
        };

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [lineItem],
      customer_email: customerEmail,
      success_url: `${env.siteUrl}/upload?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/start?canceled=1`,
      // Surfaced back to us in the checkout.session.completed webhook. Keys are
      // domain property names, so the webhook reads them straight across.
      metadata: {
        customerEmail,
        playerName,
        playerAge: playerAge?.toString() ?? "",
        focus: focus ?? "",
        customerNotes: customerNotes ?? "",
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not start checkout. Please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] Stripe session create failed:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }
}
