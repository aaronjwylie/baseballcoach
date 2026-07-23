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

## Airtable schema

Create a base with one table (default name **`Submissions`**, override with
`AIRTABLE_TABLE_NAME`). Field names must match exactly — they're referenced in
[src/lib/airtable.ts](src/lib/airtable.ts):

| Field | Type | Notes |
| --- | --- | --- |
| `Email` | Single line text | Customer identity |
| `Player Name` | Single line text | |
| `Player Age` | Single line text | Optional |
| `Sport` | Single line text | Focus area (Hitting/Pitching/…) |
| `Notes` | Long text | Customer note + system messages |
| `Status` | Single select | Options: `Awaiting Upload`, `In Review`, `Complete` |
| `Stripe Session ID` | Single line text | |
| `Mux Upload ID` | Single line text | |
| `Mux Asset ID` | Single line text | |
| `Mux Playback ID` | Single line text | |
| `Feedback Link` | URL | Loom/PDF link the client pastes in |
| `Created At` | Single line text | ISO timestamp set by the app |
| `Feedback Emailed` | Checkbox | Optional. Set by the notify webhook to avoid double-sending the "feedback ready" email |

Suggested views for day-to-day operation: **New** (`Status = Awaiting Upload` or
`In Review`), **Complete**, plus per-coach filtered views once a coach-assignment
field is added.

Use a personal access token (scopes `data.records:read`, `data.records:write`)
for `AIRTABLE_API_KEY` and the base ID (`app…`) for `AIRTABLE_BASE_ID`.

## Stripe setup

1. Add `STRIPE_SECRET_KEY` from the dashboard.
2. Pricing comes from `site.price` in `site.ts` by default (no Stripe Product
   needed). To use a pre-created Price instead, set `STRIPE_PRICE_ID`.
3. **Webhook** → endpoint `POST /api/webhooks/stripe`, event
   `checkout.session.completed`. Put its signing secret in
   `STRIPE_WEBHOOK_SECRET`.

Local testing with the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# use the printed whsec_... as STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed
```

## Mux setup

1. Create an access token (`MUX_TOKEN_ID` / `MUX_TOKEN_SECRET`).
2. **Webhook** → endpoint `POST /api/webhooks/mux`. Put its signing secret in
   `MUX_WEBHOOK_SECRET`. Handled events: `video.asset.ready`,
   `video.asset.errored`.
3. `cors_origin` for direct uploads is set from `NEXT_PUBLIC_SITE_URL`, so keep
   that accurate per environment.

The submission's Airtable record ID travels as the asset `passthrough`, so the
Mux webhook can map a ready asset back to its row.

## Email (Resend)

Optional. Set `RESEND_API_KEY` and a verified `EMAIL_FROM`. If the key is unset,
emails are skipped with a log line and never break a webhook. Templates live in
[src/lib/email.ts](src/lib/email.ts). The "payment received" and "video
received" emails fire from the Stripe and Mux webhooks; the "feedback ready"
email fires from the Airtable automation below.

## Feedback-ready notification

When a coach finishes a review and sets `Status = Complete` (with a
`Feedback Link`) in Airtable, an **Airtable automation** calls
`POST /api/webhooks/airtable` and the app emails the customer their link.

Set it up once in the Airtable base → **Automations**:

1. **Trigger:** *When a record matches conditions* → `Status` is `Complete` and
   `Feedback Link` is not empty. (This fires once per record, when it first
   matches.)
2. **Action:** *Send request* (webhook):
   - **Method:** `POST`
   - **URL:** `https://<your-site>/api/webhooks/airtable`
   - **Header:** `x-webhook-secret: <AIRTABLE_WEBHOOK_SECRET>`
   - **Body (JSON):** `{ "recordId": "<record id from the trigger>" }`

Set `AIRTABLE_WEBHOOK_SECRET` in the host env to the same value used in the
header. Add a **`Feedback Emailed`** checkbox column (see schema) so a re-fired
automation can't email the customer twice — the endpoint works without it but
then relies solely on the trigger firing once.

## Deploying

Deploy to Vercel (or any Node host). Set every variable from `.env.example` in
the host's environment, and point the Stripe and Mux webhooks at the deployed
URLs. Set `NEXT_PUBLIC_SITE_URL` to the production origin.

## Notes on Next.js 16

This project targets Next.js 16, which has breaking changes vs. earlier
versions (async `params`/`searchParams`, Turbopack by default, `middleware` →
`proxy`, and more). Before changing framework-level code, read the relevant
guide in `node_modules/next/dist/docs/` — see `AGENTS.md`.
