# Diamond Path — Lean Validation Build

A thin custom front door (landing page, checkout, video upload, status lookup)
on top of existing back-office tools (Stripe, Mux, Airtable, Resend). Customers
pay per video review and upload footage; the client operates the coaching
workflow manually in Airtable. See the project proposal for the full rationale.

Built with **Next.js 16 (App Router, Turbopack)**, React 19, and Tailwind CSS v4.

## What's in here

| Area | Path |
| --- | --- |
| Landing page | [src/app/page.tsx](src/app/page.tsx) |
| Start (player info) form | [src/app/start/](src/app/start/) |
| Video upload page (Mux) | [src/app/upload/](src/app/upload/) |
| Status lookup | [src/app/status/](src/app/status/) |
| Checkout API | [src/app/api/checkout/route.ts](src/app/api/checkout/route.ts) |
| Mux direct-upload API | [src/app/api/mux/upload/route.ts](src/app/api/mux/upload/route.ts) |
| Status lookup API | [src/app/api/status/route.ts](src/app/api/status/route.ts) |
| Stripe webhook | [src/app/api/webhooks/stripe/route.ts](src/app/api/webhooks/stripe/route.ts) |
| Mux webhook | [src/app/api/webhooks/mux/route.ts](src/app/api/webhooks/mux/route.ts) |
| Tool clients & content | [src/lib/](src/lib/) |

All customer-editable copy (name, tagline, pricing, coach bios, FAQ) lives in
**[src/lib/site.ts](src/lib/site.ts)** — change content there, not in components.

## The flow

```
Landing → /start (player info) → Stripe Checkout (hosted)
   → back to /upload?session_id=... → Mux drag-and-drop upload → confirmation

Stripe webhook  (checkout.session.completed) → create Airtable row + "payment received" email
Mux webhook     (video.asset.ready)          → row → "In Review" + "video received" email
Client (manual) → assigns coach, adds Feedback Link, sets Status = Complete
Airtable automation → POST /api/webhooks/airtable → "feedback ready" email to customer
/status         → customer enters email → sees status + feedback link
```

The Airtable row is created by the Stripe webhook, but the upload endpoint will
also create-or-find it from the paid session, so the upload step never blocks on
webhook timing.

## Getting started

1. **Install**
   ```bash
   npm install
   ```
2. **Configure** — copy `.env.example` to `.env.local` and fill in the values
   (see the sections below for where each comes from).
   ```bash
   cp .env.example .env.local
   ```
3. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

`npm run build` produces the production build; `npm run lint` runs ESLint.

## Setting up the services

**Account setup, the Airtable base schema, webhook configuration, DNS, and
deployment all live in [OPERATIONS.md](OPERATIONS.md)** — that's the single
runbook. This file deliberately doesn't repeat them; two copies of a schema
means one of them is wrong.

Env vars are documented in [.env.example](.env.example) and read in exactly one
place, [src/lib/env.ts](src/lib/env.ts). Required values throw at point of use
with a message naming the variable.

### Local webhook testing

Stripe events won't reach `localhost` on their own — forward them:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# use the printed whsec_... as your local STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed
```

Mux can't reach localhost either. Either point a Mux webhook at a tunnel
(`ngrok http 3000`) or exercise the handler directly with a saved payload.

Emails are skipped entirely when `RESEND_API_KEY` is unset, which is usually
what you want locally — the flow still works, and the `[email]` log lines tell
you what would have been sent.

## Where things are documented

| Question | Look in |
| --- | --- |
| What are we building, and why this way? | [CLAUDE.md](CLAUDE.md) |
| What's actually built vs. specified? | [CLAUDE.md §0](CLAUDE.md#0-where-this-project-actually-is) |
| How do I set up an account / webhook / the base? | [OPERATIONS.md](OPERATIONS.md) |
| How does the client run this day to day? | [OPERATIONS.md §11](OPERATIONS.md#11-yutas-daily-workflow) |
| Why is *this* done this odd way? | [docs/decisions/](docs/decisions/) |

**The codebase is being realigned to CLAUDE.md** — naming, folder structure, and
the payment flow are all in flight. Read [CLAUDE.md
§0](CLAUDE.md#0-where-this-project-actually-is) before starting anything
substantial, or you may build against a layout that's about to move.

## Notes on Next.js 16

This project targets Next.js 16, which has breaking changes vs. earlier
versions (async `params`/`searchParams`, Turbopack by default, `middleware` →
`proxy`, and more). Before changing framework-level code, read the relevant
guide in `node_modules/next/dist/docs/` — see `AGENTS.md`.
