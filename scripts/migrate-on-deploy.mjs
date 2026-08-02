/**
 * Apply pending migrations as part of a production deploy.
 *
 * We shipped code whose schema hadn't landed and took the site down with it.
 * The gap between "push to main" and "someone remembers to migrate" is an
 * outage, and it will keep being one for as long as it depends on remembering.
 *
 * ## Why this fails the build rather than warning
 *
 * A build that can't migrate must not produce a deploy. The alternative is
 * exactly what just happened: fresh code live against an old schema, every
 * request erroring. Failing here leaves the previous deploy serving, which is
 * the better of the two bad outcomes — Vercel keeps the last good build live
 * when a new one fails.
 *
 * ## Why it only runs on production
 *
 * Preview deploys build from any branch, including one carrying a migration
 * nobody has agreed to yet. If previews share the production database — which
 * they do here — an unreviewed migration would land on live data the moment
 * someone opened a pull request. So the gate is `VERCEL_ENV`, and previews are
 * deliberately left to run against whatever schema production already has.
 *
 * That means **a preview of a branch with a pending migration will misbehave**,
 * in the same way production just did. That's the trade: a broken preview is
 * cheap and visible; an unreviewed migration on live data is neither.
 *
 * ## Why it's safe to run on every production build
 *
 * `drizzle-kit migrate` is journal-tracked and idempotent — a redeploy with no
 * new migrations is a no-op. Running it every time is what makes it reliable;
 * running it only "when needed" reintroduces the judgement call this exists to
 * remove.
 */
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL;

// Local `npm run build` has no VERCEL_ENV. Developers migrate deliberately
// (`npm run db:migrate`); a build shouldn't reach into their database.
if (!env) {
  console.log("[migrate] not a Vercel build — skipping (use npm run db:migrate)");
  process.exit(0);
}

if (env !== "production") {
  console.log(`[migrate] ${env} deploy — skipping, previews share the production database`);
  process.exit(0);
}

if (!url) {
  // A production build with no database is misconfigured, and shipping it would
  // only move the failure to the first request.
  console.error("[migrate] production build with no DATABASE_URL — refusing to build");
  process.exit(1);
}

console.log("[migrate] production deploy — applying pending migrations");
const result = spawnSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.error(
    "[migrate] migration failed — failing the build so the current deploy keeps serving",
  );
  process.exit(result.status ?? 1);
}

console.log("[migrate] schema is up to date");
