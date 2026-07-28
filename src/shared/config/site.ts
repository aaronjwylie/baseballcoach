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
  name: "Diamond Path",
  tagline: "Elite Japanese baseball coaching, wherever you play.",
  subhead:
    "Upload a video of your swing or delivery. A professional coach trained in the Japanese system breaks it down frame by frame and sends you a personal video walkthrough within days.",
  email: "hello@example.com",
  price: {
    amountCents: 14900,
    currency: "cad",
    label: "$149",
    unit: "per video review",
  },
  turnaroundDays: "3–5 days",
} as const;
