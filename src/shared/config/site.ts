/**
 * App-wide brand facts. The single home for anything the client edits that
 * isn't page-specific — the name, what a review costs, how long it takes.
 *
 * Landing-page section copy lives in `domains/landing/model/copy.ts`, because
 * it's true of the landing page rather than of the app. Facts here are used by
 * the landing page AND the emails AND checkout, which is what earns them a
 * place in `shared/` (principle #5 — the highest node where it's still true).
 */
export const site = {
  name: "Baseball Sensei",
  /** The wireframe's hero headline. Doubles as the page title. */
  tagline: "Train like Japan's best players",
  /**
   * The wireframe's hero subhead, which is also the meta description. Its
   * first word reads "Seisei" in the wireframe — transcribed here as the brand
   * name, on the reading that it is a typo for Sensei.
   */
  subhead:
    "Baseball Sensei provides pitching analysis and batting analysis by a professional baseball coach from Japan.",
  /**
   * The public contact address — shown on /contact, /terms, and in the footer.
   *
   * Distinct from `EMAIL_FROM`, which is who transactional mail is *sent as*,
   * and from the operator address notifications go *to* (read from the admin
   * user's row — see docs/design/emails.md). Three different jobs; collapsing
   * them would mean a change of operator silently changing the public address.
   */
  email: "contact@baseball-sensei.com",
  /**
   * `amountCents` is what Stripe actually charges — the landing page's price
   * and the PaymentIntent read the same field, so they cannot disagree.
   * Set to $80 on 2026-07-30 to match Audrey's approved wireframe.
   */
  price: {
    amountCents: 8000,
    currency: "cad",
    label: "$80",
    unit: "per submission",
  },
  /**
   * The customer-facing SLA, in the wireframe's words. Every promise of speed
   * — landing page, checkout, upload confirmation, emails — reads this, so
   * tightening or relaxing it is one edit, not a hunt.
   */
  turnaround: "48 hours",
} as const;
