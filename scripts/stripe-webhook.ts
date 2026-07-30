/**
 * Manage the Stripe webhook endpoint, and capture its signing secret.
 *
 *   npm run stripe -- --list                       endpoints, and whether they're right
 *   npm run stripe -- --create --url <origin>      create one, print the secret
 *   npm run stripe -- --repoint <we_…>             fix an endpoint's event list
 *
 * **Dry run by default.** Nothing is created or changed without `--apply`.
 *
 * ## Why this exists
 *
 * Stripe returns a webhook's signing secret **only when the endpoint is
 * created** — retrieving it later omits the secret. So creating the endpoint
 * through the API is the one way to get the secret without copying it out of the
 * dashboard by hand.
 *
 * More importantly, it makes the event list impossible to get wrong. The events
 * come from `HANDLED_STRIPE_EVENTS` in the payment domain, so what Stripe is
 * told to send is the same list the handler switches on. **That drift is a
 * silent failure**: an endpoint still subscribed to `checkout.session.completed`
 * (what this app used before Step 5) accepts payments and never creates a
 * submission row, with nothing anywhere reporting a problem.
 *
 * ## Test and live are separate
 *
 * The mode follows the key. An `sk_test_` key manages test-mode endpoints only;
 * the live endpoint is a separate object needing the live key, and its secret is
 * different. Both are printed with their mode so there's no guessing.
 */
import "./loadEnv";
import type Stripe from "stripe";
import { stripe } from "@/shared/stripe/client";
import { env } from "@/shared/config/env";
import { HANDLED_STRIPE_EVENTS } from "@/domains/payment";

const WEBHOOK_PATH = "/api/webhooks/stripe";

/**
 * The events we want Stripe to send, from the domain's own list.
 *
 * Stripe types `enabled_events` as a closed union of every event name it
 * publishes. `HANDLED_STRIPE_EVENTS` members are all valid members of it, so this
 * asserts that once, here, rather than casting at each call site.
 */
const WANTED = [...HANDLED_STRIPE_EVENTS] as Stripe.WebhookEndpointCreateParams.EnabledEvent[];

/** The same list as plain strings, for comparing against what Stripe reports. */
const WANTED_NAMES: string[] = [...HANDLED_STRIPE_EVENTS];

function mode(): "test" | "live" | "unknown" {
  const key = env.stripeSecretKey;
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "unknown";
}

function compareEvents(enabled: string[]) {
  const missing = WANTED_NAMES.filter((e) => !enabled.includes(e));
  const extra = enabled.filter((e) => !WANTED_NAMES.includes(e) && e !== "*");
  return { missing, extra, ok: missing.length === 0 };
}

async function list() {
  const { data } = await stripe().webhookEndpoints.list({ limit: 100 });

  if (data.length === 0) {
    console.log("No webhook endpoints on this account (in this mode).\n");
    console.log("  → create one:  npm run stripe -- --create --url https://<your-site> --apply");
    return;
  }

  console.log(`${data.length} endpoint(s):\n`);
  for (const ep of data) {
    const { missing, extra, ok } = compareEvents(ep.enabled_events);
    console.log(`  ${ep.id}  [${ep.status}]`);
    console.log(`    ${ep.url}`);
    console.log(`    events: ${ep.enabled_events.join(", ")}`);

    if (!ep.url.endsWith(WEBHOOK_PATH)) {
      console.log(`    ! url doesn't end in ${WEBHOOK_PATH} — is this ours?`);
    }
    if (ok && extra.length === 0) {
      console.log("    ✓ event list matches what the app handles");
    } else {
      if (missing.length) {
        console.log(`    ⚠ MISSING: ${missing.join(", ")}`);
        console.log("      Payments will succeed and no submission row will be created.");
      }
      if (extra.length) {
        console.log(`    · also subscribed to (harmless, ignored): ${extra.join(", ")}`);
      }
      console.log(`      → fix:  npm run stripe -- --repoint ${ep.id} --apply`);
    }
    console.log();
  }

  console.log(
    "Secrets aren't shown: Stripe returns a signing secret only at creation.\n" +
      "If you don't have it, roll it in the dashboard (Developers → Webhooks →\n" +
      "the endpoint → Signing secret → Roll) and paste the new one.",
  );
}

async function create(origin: string, applying: boolean) {
  const url = `${origin.replace(/\/$/, "")}${WEBHOOK_PATH}`;

  const { data } = await stripe().webhookEndpoints.list({ limit: 100 });
  const clash = data.find((ep) => ep.url === url);
  if (clash) {
    console.log(`✗ An endpoint for ${url} already exists (${clash.id}).`);
    console.log(`  Its event list: ${clash.enabled_events.join(", ")}`);
    const { ok } = compareEvents(clash.enabled_events);
    console.log(
      ok
        ? "  Events are already correct. If you need its secret, roll it in the dashboard."
        : `  → fix its events:  npm run stripe -- --repoint ${clash.id} --apply`,
    );
    return;
  }

  console.log(`Would create a ${mode()}-mode endpoint:`);
  console.log(`    url:    ${url}`);
  console.log(`    events: ${WANTED_NAMES.join(", ")}`);

  if (!applying) {
    console.log("\n  DRY RUN — nothing created. Add --apply to execute.");
    return;
  }

  const endpoint = await stripe().webhookEndpoints.create({
    url,
    enabled_events: WANTED,
    description: "Baseball coaching platform — payment fulfillment",
  });

  console.log(`\n✓ created ${endpoint.id} (${mode()} mode)`);
  console.log(`\n  STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
  console.log(
    "\n  ↑ This is shown ONCE. Put it in .env.local for local use, and in the\n" +
      "    host's environment variables for the deployed app. If you lose it,\n" +
      "    roll it in the dashboard rather than creating a second endpoint.",
  );
}

async function repoint(endpointId: string, applying: boolean) {
  const endpoint = await stripe().webhookEndpoints.retrieve(endpointId);
  const { missing, extra, ok } = compareEvents(endpoint.enabled_events);

  console.log(`${endpoint.id}\n    ${endpoint.url}`);
  console.log(`    now:  ${endpoint.enabled_events.join(", ")}`);
  console.log(`    want: ${WANTED_NAMES.join(", ")}`);

  if (ok && extra.length === 0) {
    console.log("\n✓ Already correct — nothing to do.");
    return;
  }
  if (missing.length) console.log(`\n    adding:   ${missing.join(", ")}`);
  if (extra.length) console.log(`    dropping: ${extra.join(", ")}`);

  if (!applying) {
    console.log("\n  DRY RUN — nothing changed. Add --apply to execute.");
    return;
  }

  await stripe().webhookEndpoints.update(endpointId, { enabled_events: WANTED });
  console.log("\n✓ event list updated. The signing secret is unchanged.");
}

function reportAndExit(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("environment variable")) {
    console.error(`\n✗ ${message}`);
    console.error("  Add it to .env.local — see .env.example.\n");
  } else if (/Invalid API Key/i.test(message)) {
    console.error(`\n✗ ${message}`);
    console.error(
      "  STRIPE_SECRET_KEY is still a placeholder. Get it from\n" +
        "  https://dashboard.stripe.com/test/apikeys → Secret key → Reveal.\n",
    );
  } else {
    console.error(`\n✗ ${message}\n`);
  }
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const applying = argv.includes("--apply");
  const flag = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const m = mode();
  console.log(`Stripe ${m.toUpperCase()} mode${applying ? " · APPLY — this writes." : " · dry run"}\n`);
  if (m === "live") {
    console.log("⚠ This is a LIVE key. Changes affect the real payment flow.\n");
  }

  if (argv.includes("--create")) {
    const origin = flag("--url");
    if (!origin) {
      console.error("✗ --create needs --url <origin>, e.g. https://baseballcoach.vercel.app\n");
      process.exit(1);
    }
    return create(origin, applying);
  }

  const repointId = flag("--repoint");
  if (repointId) return repoint(repointId, applying);

  if (argv.includes("--list")) return list();

  console.log(
    [
      "Usage: npm run stripe -- <command> [--apply]",
      "",
      "  --list                     endpoints, and whether their events are right",
      "  --create --url <origin>    create an endpoint and print its signing secret",
      "  --repoint <we_…>           correct an existing endpoint's event list",
      "",
      "Dry run unless --apply is given.",
    ].join("\n"),
  );
}

main().catch(reportAndExit);
