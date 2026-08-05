// drizzle-kit config: generate + apply migrations from the schema.
// Loads .env.local the same way the app and scripts do, so DATABASE_URL
// resolves without a second env convention.
import "./scripts/loadEnv";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    // Migrations need a direct session (prepared statements), so prefer
    // Supabase's non-pooling URL in prod; fall back to DATABASE_URL locally.
    url:
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      "",
  },
});
