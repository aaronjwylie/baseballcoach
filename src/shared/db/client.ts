/**
 * The one database connection.
 *
 * A single postgres.js pool, wrapped by Drizzle. Cached on `globalThis` in dev
 * so Next's hot reload doesn't open a new pool on every edit. `casing:
 * "snake_case"` matches the mapping declared in `drizzle.config.ts`.
 *
 * Server-only. Nothing in `app/` or a client component imports this directly —
 * the domains do (see structure.md §3b).
 *
 * **No `schema` argument, deliberately.** Drizzle only wants one to power the
 * relational query API (`db.query.x.findMany`), which this codebase has never
 * used — every read is an explicit `select`. Passing it would drag every domain
 * into `shared/`, which is the one thing this floor may not know about.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/shared/config/env";

const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
};

// `prepare: false` is required for a transaction-mode pooler (Supabase's pooled
// URL, port 6543) and harmless against the local/direct connection.
const client =
  globalForDb._pgClient ?? postgres(env.databaseUrl, { max: 10, prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgClient = client;
}

export const db = drizzle(client, { casing: "snake_case" });

/**
 * The connection, or a transaction handle on it.
 *
 * Any function that may be called both standalone and inside a
 * `db.transaction(...)` takes one of these. It lived privately in
 * `submissionEventApi` until a second file needed it — a type describing the
 * database belongs with the database, not with the first domain to want it.
 */
export type Db = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
