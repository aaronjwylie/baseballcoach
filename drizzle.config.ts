// drizzle-kit config: generate + apply migrations from the schema.
// Loads .env.local the same way the app and scripts do, so DATABASE_URL
// resolves without a second env convention.
import "./scripts/loadEnv";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shared/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
