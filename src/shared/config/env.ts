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

  // Email (Resend). Optional — email failures should never break the flow.
  get resendApiKey() {
    return optional("RESEND_API_KEY");
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || "Baseball Sensei <onboarding@resend.dev>";
  },
} as const;
