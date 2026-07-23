import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { site } from "@/lib/site";
import { parseSubmission } from "@/lib/submission";

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

  const parsed = parseSubmission(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { email, playerName, playerAge, focus, notes } = parsed.value;

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
      customer_email: email,
      success_url: `${env.siteUrl}/upload?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/start?canceled=1`,
      // Surfaced back to us in the checkout.session.completed webhook.
      metadata: {
        email,
        playerName,
        playerAge: playerAge ?? "",
        focus: focus ?? "",
        notes: notes ?? "",
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
    // TEMP DIAGNOSTIC: surface the underlying failure so we can see why
    // checkout 502s in production. Revert to the generic message once fixed.
    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again.", detail },
      { status: 502 },
    );
  }
}
