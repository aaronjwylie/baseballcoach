/**
 * Load `.env.local` for standalone scripts.
 *
 * Next.js loads env files itself, so the app never needs this — but a script run
 * under `tsx` gets none of it, and `shared/config/env.ts` then throws that every
 * variable is missing even though they're all sitting in `.env.local`.
 *
 * Uses Next's own loader rather than `dotenv` so scripts resolve **exactly** the
 * same files in the same precedence order the app does (`.env.local` over
 * `.env.development` over `.env`). A second implementation would be a second
 * source of truth about which file wins.
 *
 * Import this **first**, before anything that reads `env`.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true, {
  info: () => {},
  error: (...args: unknown[]) => console.error(...args),
});
