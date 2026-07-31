/**
 * Centralized, lazy access to **server-only** environment variables.
 *
 * Browser-visible config lives in `publicEnv.ts`. Never import this file from a
 * client component — it exists to hold secrets, and that split is the boundary.
 *
 * Server-only values throw if read at runtime while missing, so a
 * misconfiguration fails loudly at the point of use rather than silently.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  // Public site URL, e.g. https://diamondpath.example.com
  get siteUrl(): string {
    return (
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3000"
    );
  },

  // Postgres — the system of record. Dockerized locally; in prod, Supabase's
  // integration provides POSTGRES_URL (pooled), so accept either name.
  get databaseUrl() {
    return (
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      required("DATABASE_URL")
    );
  },

  // Auth.js session/JWT secret for the operator portal.
  get authSecret() {
    return required("AUTH_SECRET");
  },

  // Optional site-wide HTTP Basic Auth — hides the whole site behind a browser
  // username/password prompt while it's being built. Active only when BOTH are
  // set; clear them (and redeploy) to lift the gate.
  get basicAuthUser() {
    return optional("BASIC_AUTH_USER");
  },
  get basicAuthPassword() {
    return optional("BASIC_AUTH_PASSWORD");
  },

  // Object storage. In dev, files live on local disk under this dir; in prod
  // the Blob driver uses BLOB_READ_WRITE_TOKEN instead.
  get storageDir() {
    return process.env.STORAGE_DIR || "./.storage";
  },
  get blobToken() {
    return optional("BLOB_READ_WRITE_TOKEN");
  },

  // Stripe
  get stripeSecretKey() {
    return required("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return required("STRIPE_WEBHOOK_SECRET");
  },
  // Optional: use a pre-created Stripe Price. If unset, checkout builds
  // inline price_data from the pricing in `site.ts` — one less thing to
  // configure for the validation build.
  get stripePriceId() {
    return optional("STRIPE_PRICE_ID");
  },

  /**
   * Shared secret Vercel Cron presents when invoking the retention sweep.
   *
   * Optional to *read*, but the sweep route refuses to run without it rather
   * than degrading — an unguarded endpoint that deletes customer files is worse
   * than a sweep that never runs.
   */
  get cronSecret() {
    return optional("CRON_SECRET");
  },

  // Email (Resend). Optional — email failures should never break the flow.
  get resendApiKey() {
    return optional("RESEND_API_KEY");
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || "Baseball Sensei <onboarding@resend.dev>";
  },
} as const;
