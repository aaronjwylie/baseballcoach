/**
 * Fire a signed webhook at a running dev server.
 *
 * Why this exists: the three webhooks are where most of the backend logic lives,
 * and until now the only way to reach them was to make Stripe or Mux send one —
 * which meant a real payment, a real upload, and a tunnel to localhost.
 *
 * Because we hold the same signing secrets the platforms use, we can sign a
 * payload ourselves. The handler cannot tell the difference: it verifies the
 * signature exactly as it would in production. **No Stripe CLI, no Mux account,
 * no ngrok.**
 *
 *   npm run webhook -- stripe                    a paid checkout.session.completed
 *   npm run webhook -- mux <recordId>            video.asset.ready for that row
 *   npm run webhook -- mux-error <recordId>      video.asset.errored
 *   npm run webhook -- feedback <recordId>       the Airtable feedback-ready hook
 *
 *   --url http://localhost:3000                  target (this is the default)
 *   --email someone@seed.test                    stripe only: who "paid"
 *
 * Get a `<recordId>` from `npm run seed -- --list`.
 *
 * This exercises the real handlers against the real base, so the same base
 * warning in `seed-airtable.ts` applies.
 */
import "./loadEnv";
import { createHmac } from "node:crypto";
import { env } from "@/shared/config/env";

type Command = "stripe" | "mux" | "mux-error" | "feedback";

/**
 * Stripe and Mux use the same signature scheme: HMAC-SHA256, hex, computed over
 * `${timestamp}.${rawBody}`, presented as `t=<ts>,v1=<sig>`. Only the header
 * name differs. Both verify against the raw bytes, which is why the body string
 * is built once and reused rather than re-serialized.
 */
function signPayload(payload: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function post(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<void> {
  console.log(`→ POST ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
  } catch (err) {
    console.error(
      `\n✗ could not reach ${url}\n  Is the dev server running? \`npm run dev\`\n  ${String(err)}`,
    );
    process.exit(1);
  }

  const text = await response.text();
  const ok = response.ok;
  console.log(`${ok ? "✓" : "✗"} ${response.status} ${text || "(empty)"}\n`);

  if (!ok) {
    // 400 from a webhook route means signature verification failed — almost
    // always a secret mismatch between .env.local and what the route reads.
    if (response.status === 400) {
      console.error(
        "  A 400 here is a rejected signature. Check that the secret in\n" +
          "  .env.local matches the one the route verifies against.",
      );
    }
    process.exit(1);
  }
}

/** A Checkout Session shaped enough for `ensureSubmission` to act on. */
function stripeEvent(email: string) {
  const sessionId = `cs_test_local_${Date.now()}`;
  return {
    id: `evt_test_local_${Date.now()}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: "paid",
        amount_total: 14900,
        currency: "cad",
        customer_email: email,
        customer_details: { email },
        // Domain property names, exactly as the checkout route writes them.
        metadata: {
          customerEmail: email,
          playerName: "Webhook Test",
          playerAge: "13",
          focus: "Hitting",
          customerNotes: "Fired by scripts/test-webhook.ts",
        },
      },
    },
  };
}

function muxEvent(type: string, recordId: string) {
  return {
    type,
    object: { type: "asset", id: `asset_local_${Date.now()}` },
    id: `evt_local_${Date.now()}`,
    data: {
      id: `asset_local_${Date.now()}`,
      // The linkage: the Mux handler reads this to find the row (ADR 002).
      passthrough: recordId,
      upload_id: `upload_local_${Date.now()}`,
      playback_ids: [{ id: "DS00Spx1CV902MCtPj5WknGlR102V5HFkDe", policy: "public" }],
      status: type === "video.asset.errored" ? "errored" : "ready",
    },
  };
}

function usage(): never {
  console.log(
    `
Usage: npm run webhook -- <command> [recordId] [options]

Commands
  stripe                 a paid checkout.session.completed (creates a row)
  mux <recordId>         video.asset.ready   → row moves to "New"
  mux-error <recordId>   video.asset.errored → row back to "Awaiting Upload"
  feedback <recordId>    the Airtable hook   → sends the feedback-ready email

Options
  --url <origin>         default http://localhost:3000
  --email <address>      stripe only, default seed+webhook@seed.test

Get a recordId from: npm run seed -- --list
`.trim(),
  );
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] as Command | undefined;

  const flag = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const origin = (flag("--url") ?? "http://localhost:3000").replace(/\/$/, "");

  // The first bare argument after the command — skipping flags and the values
  // that belong to them, so `mux --url http://x rec123` finds rec123.
  let recordId: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      i++; // this flag's value is not a positional
      continue;
    }
    recordId = arg;
    break;
  }

  switch (command) {
    case "stripe": {
      const email = flag("--email") ?? "seed+webhook@seed.test";
      const body = JSON.stringify(stripeEvent(email));
      console.log(`  signing with STRIPE_WEBHOOK_SECRET · payer ${email}`);
      await post(`${origin}/api/webhooks/stripe`, body, {
        "stripe-signature": signPayload(body, env.stripeWebhookSecret),
      });
      console.log("Expect: a new row in \"Awaiting Upload\" + a payment email.");
      return;
    }

    case "mux":
    case "mux-error": {
      if (!recordId?.startsWith("rec")) {
        console.error(
          "✗ needs an Airtable record id (rec…). Get one from: npm run seed -- --list\n",
        );
        usage();
      }
      const type =
        command === "mux" ? "video.asset.ready" : "video.asset.errored";
      const body = JSON.stringify(muxEvent(type, recordId));
      console.log(`  signing with MUX_WEBHOOK_SECRET · ${type} · ${recordId}`);
      await post(`${origin}/api/webhooks/mux`, body, {
        "mux-signature": signPayload(body, env.muxWebhookSecret),
      });
      console.log(
        command === "mux"
          ? 'Expect: row → "New", playback id set, video-received email.'
          : 'Expect: row → "Awaiting Upload" with a [system] line in Internal Notes.',
      );
      return;
    }

    case "feedback": {
      if (!recordId?.startsWith("rec")) {
        console.error(
          "✗ needs an Airtable record id (rec…). Get one from: npm run seed -- --list\n",
        );
        usage();
      }
      const body = JSON.stringify({ recordId });
      console.log(`  shared secret · ${recordId}`);
      await post(`${origin}/api/webhooks/airtable`, body, {
        "x-webhook-secret": env.airtableWebhookSecret,
      });
      console.log(
        'Expect: "sent" if the row is Complete with a link and hasn\'t been\n' +
          'emailed; "not-ready" or "already-sent" otherwise — all are 200.',
      );
      return;
    }

    default:
      usage();
  }
}

/**
 * Config problems are the most common failure here and deserve a sentence, not
 * a stack trace. `env` already throws naming the missing variable; surface that
 * and point at where it's documented.
 */
function reportAndExit(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("environment variable")) {
    console.error(`\n✗ ${message}`);
    console.error("  Add it to .env.local — see .env.example for what it's for.\n");
  } else {
    console.error(`\n✗ ${message}`);
    if (err instanceof Error && err.stack) {
      console.error(err.stack.split("\n").slice(1, 4).join("\n"));
    }
  }
  process.exit(1);
}

main().catch(reportAndExit);
