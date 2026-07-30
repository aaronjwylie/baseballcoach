/**
 * Drive a complete payment through the real Stripe API, without a browser.
 *
 * Stripe publishes canned payment-method tokens for test mode, so a payment can
 * be created and confirmed server-side. That exercises everything the customer
 * journey does except the card fields themselves: our PaymentIntent creation,
 * Stripe's confirmation, our succeeded-intent check, the webhook, fulfillment,
 * and the Airtable row.
 *
 *   npm run payment                      succeed, then fire the webhook
 *   npm run payment -- --card declined   a declined card
 *   npm run payment -- --card 3ds        one that demands authentication
 *   npm run payment -- --no-webhook      create and confirm only
 *   npm run payment -- --url <origin>    where to post the webhook
 *
 * ## Test mode only — enforced, not advised
 *
 * The script refuses to run against an `sk_live_` key. Confirming a live
 * PaymentIntent moves real money, and no verification is worth that risk.
 *
 * ## What this cannot check
 *
 * The `<PaymentElement>` UI — that the card field renders, that Stripe's
 * appearance variables took, that the 3-D Secure modal behaves. Those need a
 * real browser. Everything server-side is covered here.
 */
import "./loadEnv";
import { createHmac } from "node:crypto";
import type Stripe from "stripe";
import { stripe } from "@/shared/stripe/client";
import { env } from "@/shared/config/env";
import {
  createPaymentIntent,
  getSucceededPaymentIntent,
} from "@/domains/payment";
import { findByStripePaymentId } from "@/domains/submission";

/** Stripe's canned test payment methods. */
const CARDS = {
  visa: { token: "pm_card_visa", expect: "succeeds" },
  declined: { token: "pm_card_chargeDeclined", expect: "is declined" },
  "3ds": {
    token: "pm_card_authenticationRequired",
    expect: "requires authentication",
  },
} as const;

type CardName = keyof typeof CARDS;

function signStripe(payload: string, secret: string) {
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

function reportAndExit(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("environment variable")) {
    console.error(`\n✗ ${message}`);
    console.error("  Add it to .env.local — see .env.example.\n");
  } else {
    console.error(`\n✗ ${message}\n`);
  }
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const secret = env.stripeSecretKey;

  // The guard that matters. Nothing else in this script runs against live keys.
  if (secret.startsWith("sk_live_")) {
    console.error(
      "\n✗ REFUSING TO RUN. STRIPE_SECRET_KEY is a LIVE key.\n" +
        "  This script confirms payments, which against a live key means moving\n" +
        "  real money. Point STRIPE_SECRET_KEY at a sk_test_… key instead.\n",
    );
    process.exit(1);
  }
  if (!secret.startsWith("sk_test_")) {
    console.warn(
      "! STRIPE_SECRET_KEY doesn't look like a test key (expected sk_test_…).\n",
    );
  }

  const cardName = (flag("--card") ?? "visa") as CardName;
  const card = CARDS[cardName];
  if (!card) {
    console.error(
      `✗ unknown --card "${cardName}". One of: ${Object.keys(CARDS).join(" · ")}`,
    );
    process.exit(1);
  }

  const origin = (flag("--url") ?? "http://localhost:3000").replace(/\/$/, "");
  const fireWebhook = !argv.includes("--no-webhook");

  // Confirm the key actually works, and say which account we're touching.
  // `balance.retrieve` needs no account id and fails loudly on a bad key.
  await stripe().balance.retrieve();
  console.log(`Stripe key accepted · TEST mode\n`);

  // ── 1 · our own createPaymentIntent ─────────────────────────────────────
  const email = `seed+payment-${Date.now()}@seed.test`;
  const created = await createPaymentIntent({
    customerEmail: email,
    playerName: "Payment Probe",
    playerAge: 12,
    focus: "Hitting",
    customerNotes: "Created by scripts/test-payment.ts",
  });
  console.log(`1 · created  ${created.paymentIntentId}`);
  console.log(
    `             ${(created.amountCents / 100).toFixed(2)} ${created.currency.toUpperCase()} · client secret ${created.clientSecret.slice(0, 18)}…`,
  );

  // ── 2 · confirm, as the browser would ───────────────────────────────────
  console.log(`\n2 · confirming with ${card.token} (${card.expect})…`);
  let confirmed: Stripe.PaymentIntent;
  try {
    confirmed = await stripe().paymentIntents.confirm(created.paymentIntentId, {
      payment_method: card.token,
      return_url: `${origin}/upload`,
    });
  } catch (err) {
    // A decline arrives as an exception, and for this script that's a PASS when
    // it's the outcome we asked for.
    const message = err instanceof Error ? err.message : String(err);
    console.log(`   → rejected: ${message.split("\n")[0]}`);
    if (cardName === "declined") {
      console.log(
        "\n✓ Declined exactly as expected. No row should exist for this payment.",
      );
      const orphan = await findByStripePaymentId(created.paymentIntentId);
      console.log(
        orphan
          ? `✗ but a row EXISTS (${orphan.id}) — a failed payment should never create one`
          : "✓ and no Airtable row was created",
      );
      return;
    }
    throw err;
  }

  console.log(`   → status: ${confirmed.status}`);

  if (confirmed.status === "requires_action") {
    console.log(
      "\n✓ Stripe is demanding authentication, which is correct for this card.\n" +
        "  A real customer would see the 3-D Secure modal here; that step can only\n" +
        "  be completed in a browser, so this script stops.",
    );
    return;
  }

  if (confirmed.status !== "succeeded") {
    console.log(`\n! Ended in "${confirmed.status}" rather than "succeeded".`);
    return;
  }

  // ── 3 · our succeeded-intent check (what /api/mux/upload gates on) ──────
  const verified = await getSucceededPaymentIntent(created.paymentIntentId);
  console.log(
    `\n3 · getSucceededPaymentIntent → ${
      verified === null ? "✗ not found" : verified === "unpaid" ? "✗ unpaid" : "✓ succeeded"
    }`,
  );
  console.log(
    `    a bogus id → ${(await getSucceededPaymentIntent("pi_does_not_exist")) === null ? "✓ null (404)" : "✗ should have been null"}`,
  );

  if (!fireWebhook) {
    console.log(`\nSkipped the webhook. Fire it later with:
  npm run webhook -- stripe --url ${origin}`);
    return;
  }

  // ── 4 · the webhook, carrying the REAL intent ───────────────────────────
  const event = {
    id: `evt_probe_${Date.now()}`,
    object: "event",
    type: "payment_intent.succeeded",
    data: { object: confirmed },
  };
  const body = JSON.stringify(event);

  console.log(`\n4 · POST ${origin}/api/webhooks/stripe`);
  let response: Response;
  try {
    response = await fetch(`${origin}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signStripe(body, env.stripeWebhookSecret),
      },
      body,
    });
  } catch {
    console.error(
      `   ✗ couldn't reach ${origin}. Is the dev server running? \`npm run dev\``,
    );
    process.exit(1);
  }
  console.log(`   → ${response.status} ${await response.text()}`);

  // ── 5 · did fulfillment land? ───────────────────────────────────────────
  const row = await findByStripePaymentId(created.paymentIntentId);
  console.log("\n5 · Airtable row");
  if (!row) {
    console.log("   ✗ none found — fulfillment did not run");
    process.exit(1);
  }
  console.log(`   ✓ ${row.id}`);
  console.log(`     status:  ${row.status}        (expect "Awaiting Upload")`);
  console.log(`     email:   ${row.customerEmail}`);
  console.log(`     player:  ${row.playerName}, age ${row.playerAge}, ${row.focus}`);
  console.log(`     amount:  ${row.stripeAmount}`);
  console.log(`     payment: ${row.stripePaymentId}`);

  // Idempotency: the same delivery twice must not double-create.
  console.log("\n6 · re-delivering the same event (must not duplicate)");
  const again = await fetch(`${origin}/api/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signStripe(body, env.stripeWebhookSecret),
    },
    body,
  });
  console.log(`   → ${again.status} ${await again.text()}`);
  const after = await findByStripePaymentId(created.paymentIntentId);
  console.log(
    after?.id === row.id
      ? `   ✓ still one row (${after.id}) — idempotent`
      : `   ✗ row changed or duplicated`,
  );

  console.log(`\nNext, to carry this submission through upload:
  npm run webhook -- mux ${row.id} --url ${origin}`);
}

main().catch(reportAndExit);
