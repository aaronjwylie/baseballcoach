@AGENTS.md

# CLAUDE.md — Baseball Coaching Platform (v1)

**Project Handoff — Version 4 Proposal**
**Repository:** https://github.com/aaronjwylie/baseballcoach
**Status:** Built through ~Sprint 4 and deployed. Realigning to this spec — see [§0](#0-where-this-project-actually-is).

This document is the single source of truth for Claude Code building this project. Read it fully before touching any code. When it conflicts with intuition, this file wins. When it conflicts with an SDK's docs, the SDK's docs win — but flag the discrepancy.

**Operational detail lives in [OPERATIONS.md](OPERATIONS.md)** — account setup, database and storage provisioning, webhook configuration, DNS, and the operator's daily workflow. This file owns *intent*; that file owns *what to click*.

---

## Table of Contents

0. [Where this project actually is](#0-where-this-project-actually-is)
1. [Project Northstar](#1-project-northstar)
2. [Non-Goals & Anti-Scope](#2-non-goals--anti-scope)
3. [Architecture](#3-architecture)
4. [Tech Stack — Locked Decisions](#4-tech-stack--locked-decisions)
5. [Repository Structure (FSD)](#5-repository-structure-fsd)
6. [Environment Variables](#6-environment-variables)
7. [Third-Party Tool Integrations](#7-third-party-tool-integrations)
8. [Data Model (Postgres)](#8-data-model-postgres)
9. [Webhook Contracts](#9-webhook-contracts)
10. [Build Status](#10-build-status)
11. [Coding Standards](#11-coding-standards)
12. [Common Pitfalls](#12-common-pitfalls)
13. [Definition of Done](#13-definition-of-done)
14. [When to Stop and Ask](#14-when-to-stop-and-ask)
15. [Glossary](#15-glossary)

---

## 0. Where this project actually is

This document was written as a pre-build handoff. **The build ran ahead of it.**
A working, deployed, end-to-end paid flow already exists, and in several places
it diverges from what's specified below. This section is the reconciliation, so
that nothing downstream inherits a false premise.

### The 2026-07-29 direction change — operator portal + Postgres

The biggest move since kickoff, recorded in [ADR
007](docs/decisions/007-portal-and-postgres-retire-airtable.md) (and storage in
[ADR 006](docs/decisions/006-object-storage-over-mux.md)). The whole document
below now reflects it; this note is the one-paragraph orientation.

The operator side becomes a **custom portal** instead of Airtable:

- **Yuta and the coaches log in.** Admin (Yuta): all submissions, coach
  management, assignment. Coach: their assigned submissions — download the video,
  upload feedback, mark complete. **Customers still don't log in** — paid links +
  the `/status` email lookup, unchanged.
- **Vercel Postgres** is the database (via **Drizzle**); **Auth.js** guards the
  two operator roles. **Airtable, Make.com, and Mux are gone.**
- **Object storage** (Vercel Blob in prod; local disk in dev) holds both the
  customer video and the coach's feedback file.

Retires [ADR 001](docs/decisions/001-airtable-as-db.md) and
[ADR 002](docs/decisions/002-passthrough-holds-record-id.md). Still in force: the
FSD structure, the naming sweep, Zod, and Stripe Elements
([ADR 005](docs/decisions/005-stripe-elements-over-checkout.md)) — the pivot
changes the storage and operator layers, not those. The customer-facing flow
(pay → upload → status → feedback email) is unchanged.

**Status:** **deployed to production** at `baseball-sensei.vercel.app` (merged to
`main`). Supabase Postgres, Vercel Blob, jose auth, and Resend email are all wired
and working; Stripe keys + webhook are the last piece before the funnel can take
real payments ([OPERATIONS.md](OPERATIONS.md)).

### What's built — the platform pivot is done

The customer funnel (landing, player-info + Stripe Elements, upload, status)
**and** the operator portal (admin + coach) run end to end on **Postgres + object
storage + jose auth**, live in production — Airtable and Mux are gone. Verified:
login + roles, the admin submissions queue with **status filters**, **editable
coaches** + assignment, the coach's video download + **feedback delivery**, the
customer's status lookup + feedback download, and **operator change-password**
(`/account`). `next build` and `eslint` are clean. Production runs on Supabase
(schema migrated, admin seeded), Vercel Blob, and **Resend email** (verified
`baseball-sensei.com` — a real "feedback ready" email delivered to a Gmail inbox).

### Decisions that outlived the pivot

These predate the platform pivot but still hold — each has an ADR:

- **One idempotent `ensureSubmission()`, two callers** (webhook + upload) — handles
  the race between the customer returning from payment and the webhook landing
  ([ADR 003](docs/decisions/003-shared-idempotent-fulfillment.md)). Now writes to Postgres.
- **Payment is verified against Stripe, never our own row** — a stale or forged row
  can't mint an upload.
- **Transactional email is best-effort, never throws** into a webhook or a portal
  action ([ADR 004](docs/decisions/004-best-effort-email.md)).
- **Stripe Elements, not hosted Checkout** ([ADR 005](docs/decisions/005-stripe-elements-over-checkout.md)) —
  payment stays on our page.

Retired by the pivot: the Mux `passthrough` trick ([ADR 002](docs/decisions/002-passthrough-holds-record-id.md))
— a submission's own uuid is the link now — and Airtable-as-database
([ADR 001](docs/decisions/001-airtable-as-db.md)).

### One name per concept — the spine

Still the invariant, now on Postgres: the storage column names live once in the
Drizzle schema (`shared/db`), surfaced through
[`domains/submission/api/submissionRow.ts`](src/domains/submission/api/submissionRow.ts).
The domain model
([`domains/submission/model/submission.ts`](src/domains/submission/model/submission.ts))
is spelled the same in the form, the API, and the UI. **No other file turns a DB
row into a domain object** — if you're mapping columns anywhere else, you're in
the wrong file.

### Still open

- **Reformat to Audrey's approved design** when it lands — the current look is the
  reference wireframe, explicitly provisional.
- **Upload before payment** ([ADR 009](docs/decisions/009-upload-before-payment.md)) — proposed, not built.
- **The Vercel production deploy**, a verified Resend domain, and a live-mode
  Stripe webhook ([OPERATIONS.md](OPERATIONS.md)).
- Nice-to-haves: coach edit/deactivate, resumable large-file uploads, React Email,
  shadcn/ui.

---

## 1. Project Northstar

### What we're building

An online baseball coaching platform where parents pay to submit videos of their kids batting or pitching, and receive expert feedback from coaches based in Japan. Two audiences meet on it: **customers** get a smooth, professional funnel — land, pay, upload, and receive feedback — and **operators** (Yuta and his coaches) run the coaching workflow from a custom portal they log into. Payments run on Stripe, video and feedback files on object storage, transactional mail on Resend; everything else — submissions, coaches, assignment, feedback delivery — is our own application on our own database.

### The single most important sentence in this document

**Build exactly as much platform as the coaching workflow needs — and not one feature more.**

Every architectural decision follows from that. The customer funnel and the operator portal are both first-class and both custom, because both are where the product lives. But the portal exists to *run this business* — a queue, coach assignment, feedback hand-off — not to become a general SaaS. When a feature would serve scale we don't have yet, it's on the upgrade path, not in v1.

### The northstar goal

Give Yuta a functional, paying-customer-ready product he and his coaches operate end-to-end themselves, built lean and kept small. The MVP validates the concept with ~10 early users before any further investment, and has a clear upgrade path as demand grows.

### What success looks like

- A customer can visit the landing page, pay via Stripe, upload a video, and receive coach feedback by email — all without friction
- Yuta operates the workflow from his **admin portal** — managing coaches, assigning submissions, and tracking the queue at a glance
- Coaches **log into their own portal** to download assigned videos and upload their feedback response
- A submission moves from paid → uploaded → assigned → reviewed → delivered without developer intervention
- Operating costs are under ~$80 CAD/month at MVP volume
- The platform runs comfortably at this scale, and grows into more only when demand earns it

### The lean validation philosophy

The client is personally funding this as a side project to validate demand before committing to larger investment. Every decision — scope, tools, architecture — should be evaluated against this. Resist the instinct to build for scale you don't have. The operator portal is the *minimum* needed to run the coaching workflow, not a platform build-out; keep it that way.

---

## 2. Non-Goals & Anti-Scope

The following are **intentionally not built**. If a request would require adding any of these, stop and flag it as out of scope before writing code. Do not silently expand scope.

- **Customer accounts, signup flows, or customer login screens.** Customer identity stays email-based — Stripe captures it at checkout; the status lookup identifies returning customers by email. Operator logins (Yuta + coaches) are in scope and are a different thing; customers never get an account.
- **Customer dashboards** beyond the email lookup for submission status.
- **Operator features beyond running the coaching workflow.** The portal covers submissions, coaches, assignment, and feedback hand-off — not analytics suites, billing consoles, or anything that serves scale we don't have. The line is "does Yuta need it to process a submission today?"
- **Subscription billing.** Per-submission payment only.
- **Automated PDF report generation.** Coaches deliver PDFs manually if at all.
- **Custom video annotation tools** (drawing on frames, slow-motion analysis, side-by-side comparison).
- **Multilingual UI.** English at launch. Translation module is a separate future engagement.
- **Stripe Connect for coach payouts.** Yuta pays coaches manually outside the platform.
- **Native mobile apps.** iOS and Android are Phase 2.
- **Advanced analytics** beyond the submission queue and simple counts the portal shows.
- **Real-time coaching, chat, or live sessions.**
- **Japanese-specific payment methods** (Konbini, bank transfer). Stripe credit cards only.

If Yuta or Audrey asks for any of these mid-build, respond: "That's outside the scope of v1. It's on the upgrade path — happy to scope it as a change order."

---

## 3. Architecture

One Next.js app on Vercel holds everything: the public customer funnel, the
operator portal, and the API routes that glue them to Stripe, storage, and
Postgres. There is no external database and no external automation platform —
the app is the system of record and the glue.

### System diagram

```
                        Next.js app on Vercel
┌──────────────────────────────────────────────────────────────────┐
│  CUSTOMER  (public, no login)     │  OPERATOR PORTAL  (auth)       │
│  Landing → Pay → Upload           │  Admin (Yuta): queue,          │
│  → Confirm → Status lookup        │  coach mgmt, assignment        │
│                                   │  Coach: download video,        │
│                                   │  upload feedback, complete     │
└───────────────┬───────────────────────────────────┬──────────────┘
                │        API routes + actions        │
                ▼                                     ▼
   ┌──────────────────────────┐          ┌───────────────────────────┐
   │ Stripe (payments)        │          │ Object storage            │
   │  webhook → PaymentIntent │          │  Blob (prod) / disk (dev) │
   └───────────┬──────────────┘          │  video + feedback files   │
               │                         └────────────┬──────────────┘
               ▼                                      ▼
        ┌────────────────────────────────────────────────────┐
        │   Postgres  (system of record, via Drizzle)         │
        │   users · coaches · submissions                     │
        └───────────────────────────┬────────────────────────┘
                                     │
                                     ▼
                             ┌──────────────┐
                             │   Resend     │  customer emails:
                             │  (email)     │  paid · received · ready
                             └──────────────┘
```

### Key architectural principles

1. **Both surfaces are custom; the outside dependencies are few.** The customer funnel and the operator portal are ours. Stripe, object storage, and Resend are the only outside services — payments, files, and mail, the things not worth building.
2. **Postgres is the system of record.** One database, accessed through Drizzle. No second store, no external "database as a service" standing in for it.
3. **The app is the glue.** Webhook receipt, status transitions, email triggers, and assignment all live in Next.js API routes and server actions — no external automation platform.
4. **Every custom-built feature should justify its existence.** If a $20/month tool can do it and it isn't part of the product experience, use the tool.

### Hosting note (important)

**Deploy the Next.js app to Vercel.** The v4 proposal mentions GoDaddy for hosting — this refers to domain registration only. GoDaddy's standard hosting cannot run Next.js server-side code (API routes, webhooks, server components). The correct architecture is:

- **Vercel:** Hosts the Next.js app (free tier is sufficient for MVP volume)
- **GoDaddy:** Registers the domain
- **DNS:** Configured in GoDaddy, points to Vercel

If Yuta or Audrey pushes back on this, escalate to Ben before changing the architecture.

---

## 4. Tech Stack — Locked Decisions

| Layer      | Choice                     | Notes                                                            |
| ---------- | -------------------------- | ---------------------------------------------------------------- |
| Framework  | Next.js 14+ (App Router)   | TypeScript, server components by default                         |
| Language   | TypeScript (strict mode)   | No `any`, no `// @ts-ignore` without comment                     |
| Styling    | Tailwind CSS + shadcn/ui   | Copy-in components, no UI library lock-in                        |
| Forms      | React Hook Form + Zod      | Schema-first validation, shared client + server                  |
| Payments   | Stripe Elements (embedded) | Not Stripe Checkout — embedded for brand control                 |
| Storage    | Vercel Blob                | Video + feedback files; **replaced Mux** — [ADR 006](docs/decisions/006-object-storage-over-mux.md) |
| Database   | **Vercel Postgres**        | **Replaced Airtable** — [§0 pivot](#0-where-this-project-actually-is) / [ADR 007](docs/decisions/007-portal-and-postgres-retire-airtable.md) |
| ORM        | **Drizzle** (preferred)    | For Postgres; decide vs Prisma at build                          |
| Auth       | **jose** session cookies   | First-party (not Auth.js) — [ADR 008](docs/decisions/008-jose-sessions-over-authjs.md); operator portal only, no customer auth |
| Email      | Resend + React Email       | Templates as React components                                    |
| Automation | **None**                   | **Make.com dropped** — logic lives in the app / portal           |
| Hosting    | Vercel                     | Free tier for staging, Pro for prod once needed                  |
| Domain     | GoDaddy                    | Yuta's registrar of choice, DNS points to Vercel                 |
| Repo       | Single Next.js repo        | Not a monorepo                                                   |

### Do NOT introduce

- A **second** database or datastore — one Postgres, via Drizzle, is the record.
- A **different ORM** (Prisma, etc.) — Drizzle is the one.
- A **different auth library** (Clerk, Supabase Auth) — Auth.js covers the two operator roles, and there is no customer-facing auth at all.
- A state management library (Redux, Zustand) — React state is sufficient.
- A UI library beyond shadcn/ui (MUI, Chakra) — Tailwind + shadcn only.
- A custom email delivery setup (Nodemailer, SES) — use Resend.
- CSS-in-JS libraries — Tailwind only.

If one of these feels needed, the scope is probably wrong. Stop and flag it.

---

## 5. Repository Structure (FSD)

**The layout is specified in [`docs/design/structure.md`](docs/design/structure.md); the reasoning behind it is in [PRINCIPLES.md](PRINCIPLES.md).** This section used to hold a full tree; it was superseded on 2026-07-28 and reduced to a pointer, because two descriptions of one layout is exactly the drift Step 0 existed to kill.

The 30-second version:

```
src/
├── app/        Next.js routes + API handlers — thin
├── domains/    submission · payment · upload · feedback · account · coach · landing
└── shared/     the domain-less floor
```

**Domain-first, not layer-first.** A concept's data and its behavior live in *one* folder —
what a Submission *is* and what you *do* with it, together. The earlier plan here split them
across `features/` and `integrations/`; that was retired after reading the WRLD sandbox,
which had run the same experiment at larger scale and retired its own `entities/`-vs-`features/`
split.

The two invariants worth memorizing:

- **Every storage column name lives in one place** — the Drizzle schema in `shared/db`, surfaced through `domains/submission/api/`.
- **Every `process.env` read lives in one file** — `shared/config/env.ts`.

Each domain carries a `_XxxDocumentation.md` — its northstar, its honest current state, and
the dated trail of decisions that shaped it. **Read the slice's doc before changing the
slice.** They are kept true in the same commit as the code.

---

## 6. Environment Variables

All env vars go in `.env.local` for dev and Vercel project settings for prod.
`.env.example` is the live source of truth for the full list; this block is the
shape.

```bash
# === Public (browser-safe) — read via shared/config/publicEnv.ts ===
NEXT_PUBLIC_SITE_URL="http://localhost:3000"        # no trailing slash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# === Server-only — read via shared/config/env.ts ===
DATABASE_URL="postgres://app:app@localhost:5432/baseball"  # dockerized in dev, Vercel Postgres in prod
AUTH_SECRET="..."                                    # Auth.js session/JWT secret

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."                          # optional — else priced inline from site.ts

# Object storage: local disk in dev, Vercel Blob in prod
STORAGE_DIR="./.storage"                             # dev only — local-disk root
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."           # prod only

RESEND_API_KEY="re_..."                              # optional — unset = emails skipped, logged
EMAIL_FROM="Baseball Sensei <hello@yourdomain.com>"
```

### `shared/config/` — the ONLY place `process.env` is read

Two files, split by **audience** so a client component never imports a module
full of secrets (see [structure.md §5](docs/design/structure.md)):

- `shared/config/env.ts` — server-only secrets (`DATABASE_URL`, `AUTH_SECRET`,
  Stripe secret, Blob token, Resend key). Validated with Zod; required values
  throw at point of use with a message naming the variable.
- `shared/config/publicEnv.ts` — the handful of `NEXT_PUBLIC_*` values the
  browser needs.

Nothing outside that folder reads `process.env`.

```typescript
// shared/config/env.ts (shape)
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  // ...
});

export const env = envSchema.parse(process.env);
```

---

## 7. Third-Party Tool Integrations

This section is the conceptual guide to each outside service and the two internal
seams (Postgres, storage). Follow the SDK docs for exact API calls.

### Stripe — payments

- Server: `stripe` SDK for creating PaymentIntents and verifying webhooks.
- Client: `@stripe/react-stripe-js` + `@stripe/stripe-js` for the embedded
  `<PaymentElement>` — payment stays on our domain, our branding ([ADR 005](docs/decisions/005-stripe-elements-over-checkout.md)).

Flow: `/start` posts to `POST /api/payment/intent`, which creates a PaymentIntent
carrying the customer/player details in metadata and returns its `clientSecret`.
`<PaymentElement>` collects the card; on success the browser lands on
`/upload?payment_intent=…`. Stripe fires `payment_intent.succeeded` to
`POST /api/webhooks/stripe`, which **creates the submission row in Postgres**
(status `Awaiting Upload`). Idempotent on the payment-intent id.

### Object storage — video + feedback files

One `shared/storage` seam, two drivers behind a single interface: **local disk**
in dev (files under `STORAGE_DIR`), **Vercel Blob** in prod ([ADR 006](docs/decisions/006-object-storage-over-mux.md)).
Both the customer's video and the coach's feedback file go through it.

- Upload: the browser sends the file to an app route that streams it to the
  active driver and records the resulting URL/key on the submission.
- Download: the coach's link resolves through `/api/video/[id]`, which checks the
  row and serves (or redirects to) the file — links stay stable and private
  across a driver swap.

No transcoding, no streaming — the coach downloads and scrubs locally.

### Postgres — system of record

- Accessed through **Drizzle**; the connection and schema live in `shared/db`.
  Every submission / coach / user fact is a column here — one home per fact.
- Read and written by the domains, never by route files directly (see §3b).
- Email is lowercased on write and on lookup, so the status lookup matches
  regardless of case.

### Auth — operator identity (jose sessions)

First-party credentials auth, **not Auth.js** ([ADR 008](docs/decisions/008-jose-sessions-over-authjs.md)):

- Two roles: `admin` (Yuta) and `coach`. **Customers never authenticate.**
- A `jose`-signed HS256 JWT in an httpOnly cookie (`shared/auth`). The DAL in
  `domains/account` does the secure `requireSession` / `requireRole` checks close
  to the data; `proxy.ts` (Next 16's renamed Middleware) does an optimistic
  pre-filter, never the sole defence.
- Passwords are bcrypt-hashed and never leave `userApi.ts`. The first admin is
  **seeded** (`npm run db:seed`); Yuta adds coaches from the portal — no
  self-signup.

### Resend — transactional email

Sending goes through **`shared/email`**, never the Resend SDK directly:

- `sendEmail({ to, subject, html })` — the transport. **Best-effort**: a non-2xx
  logs and never throws ([ADR 004](docs/decisions/004-best-effort-email.md)); if
  `RESEND_API_KEY` is unset it skips-and-logs. The **from** address is
  `EMAIL_FROM`, set once in env — never passed per-send.
- `emailShell(heading, bodyHtml, cta?)` — wraps body HTML in the brand shell
  (header, type, an optional `{ label, url }` button, footer).

Each message lives in the domain that owns it, as `api/xEmail.ts`:
**payment received** (`domains/payment/api/paymentEmail.ts`), **video received**
(`domains/upload/api/uploadEmail.ts`), **feedback ready**
(`domains/feedback/api/feedbackEmail.ts`).

**Adding a new email** (e.g. a signup verification email) is one file plus a
best-effort call from the flow — no per-send `from`, no SDK:

```typescript
// domains/<slice>/api/verificationEmail.ts
import { emailShell, sendEmail } from "@/shared/email";
import { site } from "@/shared/config/site";

export function sendVerificationEmail(to: string, link: string) {
  return sendEmail({
    to,
    subject: `${site.name} — verify your email`,
    html: emailShell(
      "Confirm your email",
      `<p>Tap below to verify your email and finish signing up.</p>`,
      { label: "Verify email", url: link },
    ),
  });
}
```

Call it best-effort — don't let a mail hiccup fail the surrounding mutation.

**Config (live in production):** `baseball-sensei.com` is **verified in Resend**
(DKIM + SPF on the `send.` subdomain, region us-east-1), sending enabled,
`RESEND_API_KEY` set in Vercel, and
`EMAIL_FROM = "Baseball Sensei <contact@baseball-sensei.com>"`. **Receiving** is
Google Workspace (root MX) — independent of Resend, so both coexist, and a
customer reply lands in Yuta's `contact@` inbox. Dashboard/DNS detail:
[OPERATIONS.md §8](OPERATIONS.md).

### Vercel

**Role:** Hosting for the Next.js app.

**Integration approach:**

- Connect the GitHub repo to Vercel via the Vercel dashboard
- Set env vars in Vercel project settings (separate values for Production and Preview)
- Push to `main` → deploys to production
- Push to any branch → deploys a preview URL for client review

**Custom domain:** Configure in Vercel dashboard, point GoDaddy DNS to Vercel's provided A/CNAME records.

---

## 8. Data Model (Postgres)

The system of record is one Postgres database, three tables, accessed through
Drizzle. **Column names live in exactly one place** — the Drizzle schema in
`shared/db` (surfaced to the domain via `domains/submission/api/`) — and a
migration is the only way they change. One home per fact.

### `submissions`

The spine. One row per paid request; every other domain orbits it.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, primary key | our own id — the linkage key everywhere (retires the Mux `passthrough` trick) |
| `customerEmail` | text | always lowercased on write and lookup |
| `playerName` | text | |
| `playerAge` | integer | |
| `focus` | enum | `Hitting` · `Pitching` · `Fielding` · `Catching` · `Other` |
| `customerNotes` | text | the customer's words, never overwritten |
| `internalNotes` | text | system messages + operator notes |
| `status` | enum | see lifecycle below |
| `stripePaymentId` | text, unique | PaymentIntent id — the webhook's idempotency key |
| `stripeAmount` | integer (cents) | |
| `videoUrl` | text, null | storage key/URL for the customer's video |
| `assignedCoachId` | uuid, FK → `coaches.id`, null | set by the admin on assignment |
| `feedbackUrl` | text, null | storage key/URL for the coach's response |
| `feedbackEmailedAt` | timestamptz, null | idempotency guard on the feedback email |
| `submittedAt` | timestamptz, default `now()` | |
| `updatedAt` | timestamptz | |

`customerNotes` and `internalNotes` stay separate so an operator can forward a
customer's words to a coach without hand-cleaning `[system]` lines out of them.

### `status` lifecycle (enum, in order)

`awaiting_upload → new → assigned → in_review → complete`

The app writes the first two — `awaiting_upload` on payment, `new` on upload
complete. The admin drives `assigned` and `in_review` from the portal as he works
the queue; a coach marking their work done sets `complete`, **which fires the
feedback email.** The status lookup collapses the middle three into calm
customer-facing language — a parent doesn't need to know their video is
"unassigned." The transition rules live in `domains/submission`, not scattered
across the UI.

### `coaches`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, primary key | |
| `userId` | uuid, FK → `users.id` | the coach's login |
| `name` | text | |
| `specialties` | enum[] | matches the `focus` options |
| `languages` | text[] | e.g. English, Japanese |
| `isActive` | boolean | Yuta toggles from the portal |

### `users`

Operator identity for Auth.js — **operators only, never customers.**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, primary key | |
| `email` | text, unique | login |
| `passwordHash` | text | credentials auth |
| `role` | enum | `admin` · `coach` |
| `createdAt` | timestamptz | |

The first `admin` (Yuta) is **seeded**; coaches are created from the admin portal,
each paired with a `coaches` row.

---

## 9. Webhook Contracts

One inbound webhook: **Stripe**. Mux is gone — the upload route stores the file
directly, so there's no async video webhook. The feedback-ready notification is a
coach action in the portal, not a webhook.

### Stripe webhook

**Endpoint:** `POST /api/webhooks/stripe`

**Events:**

- `payment_intent.succeeded` → create the submission row in Postgres
  (`awaiting_upload`) + send the payment-received email
- `payment_intent.payment_failed` → log for admin visibility; no row created

**Signature verification:** `stripe.webhooks.constructEventAsync()` over the raw
body with `STRIPE_WEBHOOK_SECRET`. Verify before doing anything.

**Idempotency:** `stripePaymentId` is unique and `ensureSubmission()` is
idempotent on it, so a Stripe retry finds the existing row instead of duplicating.
The email is gated on first-creation.

**Response:** return `200` quickly; a handler error returns `500` so Stripe
retries — safe, because the work is idempotent.

### Raw body handling (critical)

App Router route handlers must read the **raw, unparsed body** for signature
verification — `await req.text()`, then pass the string to the verifier. Parsing
first (`req.json()`) breaks it.

```typescript
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const event = await stripe().webhooks.constructEventAsync(
    rawBody,
    signature,
    env.stripeWebhookSecret,
  );
  // ... handle event
}
```

### The file uploads (not webhooks)

`POST /api/upload` (customer video) and `POST /api/feedback/upload` (coach
feedback) take the file as the request body — gated on a Stripe-verified payment
and on operator ownership respectively. Downloads are `GET /api/video/[id]`
(operator-only) and `GET /api/feedback/[id]` (public, once complete). See the
endpoint table in [OPERATIONS.md](OPERATIONS.md).

---

## 10. Build Status

The original 8-sprint plan is retired — the platform pivot reshaped it, and git
holds the history. The build is **live in production** at `baseball-sensei.vercel.app`.

**Built, deployed, and verified:**

- ✅ **Customer funnel** — landing (Audrey's design), `/start` (info + Stripe
  Elements), `/upload` (video → storage), confirmation, `/status`, feedback download.
- ✅ **Foundation** — Postgres (Supabase in prod), Drizzle migrations, seed.
- ✅ **Auth** — jose sessions, `admin`/`coach` roles, `proxy.ts` gate, `/login`,
  operator **change-password** (`/account`).
- ✅ **Persistence + storage** — submissions on Postgres, files on the storage
  seam (local disk / Vercel Blob); Airtable + Mux retired.
- ✅ **Admin portal** — submissions queue with **status filters**, coach
  management + **editing**, coach assignment.
- ✅ **Coach portal** — assigned reviews, video download, feedback delivery →
  complete → customer email.
- ✅ **Transactional email** — payment received, video received, feedback ready,
  on **Resend** with the verified `baseball-sensei.com` domain.

**Remaining:**

- **Stripe** — production keys + the `payment_intent.succeeded` webhook, so real
  payments create submissions ([OPERATIONS.md](OPERATIONS.md) §5–§6). This is the
  last thing before the funnel can take money.
- Set `EMAIL_FROM` in Vercel (if not already) so the deployed app sends from
  `contact@baseball-sensei.com`.
- Point the site at the `baseball-sensei.com` domain (optional; it's on the
  `.vercel.app` URL today) and update `NEXT_PUBLIC_SITE_URL`.
- Deferred: an in-app `/feedback/[id]` viewer, forgot-password (email reset),
  coach deactivation UI, resumable large-file uploads, React Email, shadcn/ui, and
  upload-before-payment ([ADR 009](docs/decisions/009-upload-before-payment.md)).

> **In flight (Ben):** customer **signup + email verification** and the
> **upload-and-pay** section. The email how-to for the verification mail is in
> §7 (Resend); the operator-account/auth patterns are in `domains/account`.

> **Handoff runbook:** the step-by-step go-live — accounts, env vars, migrations,
> the Stripe webhook, DNS, and the end-to-end test — is in [OPERATIONS.md](OPERATIONS.md).


---

## 11. Coding Standards

### General

- **TypeScript strict mode.** No `any`. No `as unknown as X`. `// @ts-ignore` requires an inline comment explaining why.
- **Server components by default.** Only add `"use client"` when needed (state, effects, browser APIs, form handlers).
- **Async/await over promise chains.** Always.
- **Early returns over nested conditionals.**
- **No magic numbers or strings.** Extract to constants in `src/shared/lib/constants.ts` or feature-scoped `constants.ts`.

### Components

- **Single responsibility.** A component does one thing.
- **Composition over configuration.** `<Card><CardHeader>...</CardHeader></Card>` over `<Card header={...} />`.
- **Props are typed explicitly.** No inferred props from default values.
- **Co-locate.** Component + types + tests in one folder when it warrants a folder.

### Forms

- **React Hook Form + Zod, always.** No manual form state management.
- **Schemas in `features/<feature>/schemas.ts`.** Shared between client validation and server API validation.
- **Server re-validates.** Never trust client validation alone. Every API route validates the incoming payload with the same Zod schema.

### API routes

- **One route, one job.** Keep them small.
- **Validate input with Zod at the top.** Return `400` with structured errors if invalid.
- **Catch all errors.** Return `500` with a generic message. Log the actual error server-side.
- **Correct HTTP status codes.** 200 (success), 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error).
- **Webhooks verify signatures.** Non-negotiable.

### Naming

**Specified in [`docs/design/structure.md` §6](docs/design/structure.md).** Adopted from the
WRLD sandbox's `Nomenclature.md` on 2026-07-28 so the two codebases read alike — this
superseded the kebab-case convention previously specified here.

The short version: `PascalCase` types and components, `camelCase` modules and folders, no
hyphens in folder names, `xApi` for API clients, `_<Slice>Documentation.md` for slice docs.
`src/app/` follows Next.js instead, because the router reserves those filenames.

**One stem per concept** — a domain folder and everything in it use one word, never two forms
of the same idea.

### Comments

- **Self-documenting code preferred.** If a comment explains _what_, refactor.
- **Comments explain _why_.** Non-obvious reasoning, trade-offs, links to external docs.
- **TODOs include date and owner.** `// TODO(2026-05-30, Ben): refactor when X happens`

---

## 12. Common Pitfalls

Read this section before coding. These have bitten *this* project.

### Webhooks

- **Stripe retries failed webhooks.** Idempotency is critical — `ensureSubmission`
  is idempotent on the payment id; keep it so. A handler error returns 500 (safe).
- **Verify signatures over the raw body.** `await req.text()`, then verify. Never
  `req.json()` first.

### Postgres + Drizzle

- **Column names live once** — in the Drizzle schema (`shared/db`), mapped by
  `submissionRow.ts`. Don't spell a column anywhere else.
- **A schema change is a migration** — `npm run db:generate` then `db:migrate`.
  Never edit a table by hand.
- **The pooler needs `prepare: false`** (Supabase transaction pooler); migrations
  use the direct/non-pooling URL. Both are already wired.
- **Timestamps are `Date` in the row, ISO strings in the domain** — the mapper
  converts; don't pass a string into a Drizzle timestamp column.

### The client/server boundary

- **A client component must not import a domain barrel that re-exports DB code.**
  Importing `@/domains/submission` from a `"use client"` file pulls the Postgres
  client into the browser bundle and the build fails. Client components import the
  slice's **model** directly (schemas/types), never its barrel.
- **`shared/config/env.ts` is server-only**; browser values go through
  `publicEnv.ts`. Never import `env.ts` from a client component.

### Storage + auth

- **Files go through the `shared/storage` seam**, never a driver directly. The
  locator is stored on the submission; downloads resolve via `/api/video/[id]`
  (operator) and `/api/feedback/[id]` (public, complete-only).
- **Auth checks live close to the data** — `requireSession` / `requireRole` in the
  page or route, not only in `proxy.ts` (which is optimistic). Re-check role *and*
  ownership in any route that mutates.

### Stripe

- **Test and live use separate keys _and_ separate webhook endpoints/secrets.** A
  test-mode webhook secret fails every signature check in production.
- **PaymentIntent metadata caps each value at 500 chars.** Don't stuff blobs in.

### Email

- **Resend needs a verified domain** before it sends to anyone but the account
  owner — set it up early, DNS takes hours. Sends are best-effort: a failure logs,
  never throws into a webhook or action.

### Next.js 16

- **Middleware is `proxy.ts` now**, and `params` / `searchParams` / `cookies()`
  are **async** — `await` them.
- **Server components can't use browser APIs**; mark `"use client"` when needed.
- **Route handlers are `route.ts` with named exports** (`export async function GET/POST`).

---

## 13. Definition of Done

A feature is "done" when:

1. Code compiles with no TypeScript errors and no ESLint warnings
2. Feature works end-to-end in dev (manual test)
3. Error states are handled (network failure, validation failure, edge cases)
4. Loading states show clear user feedback
5. Mobile-friendly (tested at 375px)
6. Accessibility basics: form labels, alt text, keyboard navigable
7. Any new env vars are in `.env.example`
8. Any new manual setup steps are in OPERATIONS.md
9. Any database schema change ships as a Drizzle migration and is reflected in section 8
10. Commit message is clear; PR description summarizes what changed and what was tested

---

## 14. When to Stop and Ask

Stop and flag for human review if:

- A request would require adding something from section 2 (Non-Goals)
- The Postgres schema (a table, column, or enum) needs to change
- Stripe pricing model needs to change (per-submission vs subscription)
- A new third-party service would be introduced
- An external dependency's docs contradict this file
- The scope of a sprint feels underspecified or ambiguous
- You need credentials or DNS access

Do not silently expand scope. Do not silently swap tools. Both create risks the team can't audit later.

For anything ambiguous: **the accepted proposal (v4) is the source of truth for scope**. This CLAUDE.md is the source of truth for implementation. Ben is the source of truth for judgment calls.

---

## 15. Glossary

- **Customer** — The end user, typically a parent submitting their child's video
- **Player** — The child whose video is being reviewed (customer's child)
- **Coach** — The expert in Japan providing feedback
- **Client** — Yuta, who operates the platform day-to-day
- **Submission** — One paid request from a customer for video feedback
- **Workflow** — End-to-end process from payment to feedback delivery
- **Database** — The Postgres instance holding the `users`, `coaches`, and `submissions` tables
- **The Team** — Ben (frontend), Aaron (backend advisory), Audrey (design + client relations)

---

## Related Documents

- **[OPERATIONS.md](OPERATIONS.md)** — Account setup, database + storage provisioning, admin seeding, webhook configuration, Resend domain, Vercel, DNS, go-live checklist, and the operator workflow _(being swept to match the pivot as each piece is built)_
- **[PRINCIPLES.md](PRINCIPLES.md)** — how this codebase is built: the rules the structure rests on
- **[docs/design/structure.md](docs/design/structure.md)** — the layout, segments, dependency rules, and naming
- **`src/domains/*/_XxxDocumentation.md`** — per-slice: northstar, honest current state, and the dated decision trail. Read the slice's doc before changing the slice
- **[docs/decisions/](docs/decisions/)** — ADRs recording where and why the implementation departs from this document
- **[README.md](README.md)** — Quick start for a new developer joining
- **Proposal v4** — Scope, budget, timeline as agreed with the client. Defer to this if a stakeholder claims something is "in scope"

_(`docs/go-live.md` was folded into OPERATIONS.md — two runbooks describing two different Airtable schemas is exactly the drift this realignment exists to kill.)_

---

**End of CLAUDE.md.**

_Last updated: May 2026 · Version 1.0 · Baseball Coaching Platform v1_
