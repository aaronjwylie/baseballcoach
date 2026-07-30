/**
 * The one database connection.
 *
 * A single postgres.js pool, wrapped by Drizzle. Cached on `globalThis` in dev
 * so Next's hot reload doesn't open a new pool on every edit. `casing:
 * "snake_case"` matches the mapping declared in `drizzle.config.ts`.
 *
 * Server-only. Nothing in `app/` or a client component imports this directly —
 * the domains do (see structure.md §3b).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/shared/config/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
};

const client = globalForDb._pgClient ?? postgres(env.databaseUrl, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgClient = client;
}

export const db = drizzle(client, { schema, casing: "snake_case" });
