# Diamond Path — Lean Validation Build

A thin custom front door (landing page, checkout, video upload, status lookup)
on top of existing back-office tools (Stripe, Mux, Airtable, Resend). Customers
pay per video review and upload footage; the client operates the coaching
workflow manually in Airtable. See the project proposal for the full rationale.

Built with **Next.js 16 (App Router, Turbopack)**, React 19, and Tailwind CSS v4.

## What's in here

| Area | Path |
| --- | --- |
| Landing page | [src/domains/landing/](src/domains/landing/) |
| Paying for a review | [src/domains/payment/](src/domains/payment/) |
| Getting the video to us | [src/domains/upload/](src/domains/upload/) |
| The submission record + status lookup | [src/domains/submission/](src/domains/submission/) |
| The coach's response | [src/domains/feedback/](src/domains/feedback/) |
| Payment intent API | [src/app/api/payment/intent/route.ts](src/app/api/payment/intent/route.ts) |
| Mux direct-upload API | [src/app/api/mux/upload/route.ts](src/app/api/mux/upload/route.ts) |
| Status lookup API | [src/app/api/status/route.ts](src/app/api/status/route.ts) |
| Stripe webhook | [src/app/api/webhooks/stripe/route.ts](src/app/api/webhooks/stripe/route.ts) |
| Mux webhook | [src/app/api/webhooks/mux/route.ts](src/app/api/webhooks/mux/route.ts) |
| Domain slices | [src/domains/](src/domains/) |
| Domain-less foundation | [src/shared/](src/shared/) |

Customer-editable copy lives in two files, split by scope: app-wide brand facts
(name, price, turnaround) in **[src/shared/config/site.ts](src/shared/config/site.ts)**,
landing-page section copy in
**[src/domains/landing/model/copy.ts](src/domains/landing/model/copy.ts)**. Change
content there, never in components.

**The codebase is domain-first** — see [PRINCIPLES.md](PRINCIPLES.md) for the rules and
[docs/design/structure.md](docs/design/structure.md) for the layout. Each domain carries a
`_XxxDocumentation.md`; read a slice's doc before changing the slice.

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
place, [src/shared/config/env.ts](src/shared/config/env.ts). Required values throw at point of use
with a message naming the variable.

### Building or migrating the Airtable table

The table's shape is declared in code
([`submissionTableSpec.ts`](src/domains/submission/api/submissionTableSpec.ts)) and this
script applies or verifies it. Select options are derived from the TypeScript unions, so
Airtable's dropdowns can't drift from `SUBMISSION_STATUSES` / `FOCUS_OPTIONS`.

```bash
npm run schema -- --inspect            # live base vs. what the app expects
npm run schema -- --create --apply     # build the table in an empty base
npm run schema -- --migrate --apply    # rename + add fields on an old-schema base
```

**Dry run unless you pass `--apply`.** Needs a PAT with `schema.bases:read` and
`schema.bases:write` on top of the data scopes.

Two of the seventeen fields — `Submission ID` (autonumber) and `Submitted At`
(created time) — **must be added by hand.** Airtable's API cannot create computed
field types at all. `Submitted At` is not optional: the status lookup sorts on it
and returns 502 without it. `--inspect` flags which manual fields are load-bearing.

Airtable's API can create and **rename** fields but **cannot convert a field's type**.
Renames are therefore safe (data is preserved); the handful of conversions are manual, and
`--inspect` lists exactly which ones remain.

### The Stripe webhook endpoint

```bash
npm run stripe -- --list                                 # endpoints + whether events match
npm run stripe -- --create --url <origin> --apply        # create; prints the signing secret
npm run stripe -- --repoint <we_…> --apply               # correct an endpoint's event list
```

The event list comes from `HANDLED_STRIPE_EVENTS` in the payment domain, so what
Stripe is told to send is the same list the handler switches on. Getting that
wrong is a **silent** failure — an endpoint still on `checkout.session.completed`
(what this app used before Elements) takes payments and never creates a row.

Stripe reveals a signing secret **only at creation**, which is why creating
through the API is worth it. Dry run unless `--apply`.

### Exercising the flow without paying

Two scripts remove the need to complete a real $149 checkout every time you
touch the backend. **No Stripe CLI, no Mux account, no tunnel.**

```bash
npm run dev                              # in one terminal

npm run payment                          # a REAL Stripe test payment, no browser
npm run payment -- --card declined       # the decline path
npm run payment -- --card 3ds            # one that demands authentication

npm run seed                             # one submission in each of the 5 states
npm run seed -- --status New -n 3        # three rows in "New"
npm run seed -- --list                   # what's been seeded (with record ids)
npm run seed -- --clean                  # retire them

npm run webhook -- stripe                # a paid checkout → creates a row
npm run webhook -- mux <recordId>        # video ready → row moves to "New"
npm run webhook -- mux-error <recordId>  # processing failed
npm run webhook -- feedback <recordId>   # the feedback-ready email
```

`npm run payment` uses Stripe's canned test payment-method tokens to create *and
confirm* a real PaymentIntent server-side, then fires the webhook carrying that
real intent and checks the Airtable row. It **refuses to run against an
`sk_live_` key** — confirming a live intent moves real money. What it can't cover
is the `<PaymentElement>` UI itself; that needs a browser.

`npm run webhook` **signs its own payloads** with the secrets in `.env.local`, so
the handlers verify them exactly as they would in production — a rejected
signature comes back as a 400 and is a real failure, not a test artifact.

Both scripts write to whatever `AIRTABLE_BASE_ID` points at and print the base id
before doing anything. **Read it.** Seeded rows use `@seed.test` addresses
(RFC 2606 reserved, can never resolve) so a test send can't reach a real person,
and every row is stamped `[seed]` in `Internal Notes` so strays are findable.

Emails are skipped entirely when `RESEND_API_KEY` is unset, which is usually what
you want locally — the flow still works, and the `[email]` log lines tell you what
would have been sent.

If you'd rather use the real thing, `stripe listen --forward-to
localhost:3000/api/webhooks/stripe` still works; use the `whsec_…` it prints as
your local `STRIPE_WEBHOOK_SECRET`.

**Keep `NEXT_PUBLIC_SITE_URL` accurate per environment.** It's sent to Mux as the
direct upload's `cors_origin`, so if it doesn't match the origin you're browsing
from, uploads fail as CORS violations with no useful error.

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
