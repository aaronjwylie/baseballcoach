/**
 * Centralized, lazy access to environment variables.
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

  // Mux
  get muxTokenId() {
    return required("MUX_TOKEN_ID");
  },
  get muxTokenSecret() {
    return required("MUX_TOKEN_SECRET");
  },
  get muxWebhookSecret() {
    return required("MUX_WEBHOOK_SECRET");
  },

  // Airtable
  get airtableApiKey() {
    return required("AIRTABLE_API_KEY");
  },
  get airtableBaseId() {
    return required("AIRTABLE_BASE_ID");
  },
  get airtableTable() {
    return process.env.AIRTABLE_TABLE_NAME || "Submissions";
  },

  // Email (Resend). Optional — email failures should never break the flow.
  get resendApiKey() {
    return optional("RESEND_API_KEY");
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || "Diamond Path <onboarding@resend.dev>";
  },
} as const;
