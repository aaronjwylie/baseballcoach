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
  management, assignment. Coach: their assigned submissions — download the files,
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

- **One idempotent fulfillment, two callers** (webhook + the browser confirming) —
  handles the race between the customer returning from payment and the webhook
  landing ([ADR 003](docs/decisions/003-shared-idempotent-fulfillment.md)). It
  inverted with the flow — `ensureSubmission` became `markSubmissionPaid` — but
  the contract is unchanged.
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

- **The landing page is now Audrey's approved wireframe** (2026-07-30). Its coach
  section and photography are still placeholder and cannot go live as written.
- ~~Upload before payment~~ — **built** 2026-07-30
  ([ADR 009](docs/decisions/009-upload-before-payment.md)).
- **The Vercel production deploy**, a verified Resend domain, and a live-mode
  Stripe webhook ([OPERATIONS.md](OPERATIONS.md)).
- Nice-to-haves: coach edit/deactivate, resumable large-file uploads, React Email,
  shadcn/ui.

---

## 1. Project Northstar

### What we're building

An online baseball coaching platform where parents submit a **pack of files** — clips of their kid batting or pitching, plus any stills or documents that help — and receive expert feedback from coaches based in Japan. One submission is one review of that pack, not one video. Two audiences meet on it: **customers** get a smooth, professional funnel — land, verify their email, upload, pay, and receive feedback — and **operators** (Yuta and his coaches) run the coaching workflow from a custom portal they log into. Payments run on Stripe, uploads and feedback files on object storage, transactional mail on Resend; everything else — submissions, coaches, assignment, feedback delivery — is our own application on our own database.

**Payment comes last.** Nobody pays for a submission whose upload then fails ([ADR 009](docs/decisions/009-upload-before-payment.md)), and nothing is retained until it clears — before that a submission is a scratch pad the customer can scrub by refreshing or walking away.

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

- **Customer accounts, signup flows, or customer login screens.** Customer identity stays email-based — the status lookup identifies returning customers by an unverified email. Operator logins (Yuta + coaches) are in scope and are a different thing; customers never get an account.
  - **The 6-digit email verification in the flow is not an account** and was checked against this line before it was built: no password, no profile, nothing to sign into, one submission, expires in hours. It proves reachability so we can deliver what was bought. See [ADR 010](docs/decisions/010-verification-gates-upload.md) — including how to tell if that line ever gets crossed.
- **Customer dashboards** beyond the email lookup for submission status.
- **Operator features beyond running the coaching workflow.** The portal covers submissions, coaches, assignment, feedback hand-off, and the handful of upload/retention limits Yuta tunes — not analytics suites, billing consoles, or anything that serves scale we don't have. The line is "does Yuta need it to process a submission today?"
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
│  Landing → /start, 4 steps:       │  Admin (Yuta): queue,          │
│    1 details  2 verify email      │  coach mgmt, assignment,       │
│    3 upload   4 pay               │  settings (limits/retention)   │
│  → Confirm → Status lookup        │  Coach: download files,        │
│                                   │  upload feedback, complete     │
└───────────────┬───────────────────────────────────┬──────────────┘
                │     Server Actions + API routes    │
                ▼                                     ▼
   ┌──────────────────────────┐          ┌───────────────────────────┐
   │ Stripe (payments, LAST)  │          │ Object storage            │
   │  webhook → PaymentIntent │          │  Blob (prod) / disk (dev) │
   └───────────┬──────────────┘          │  uploads + feedback files │
               │                         └────────────┬──────────────┘
               │        browser ──uploads direct──────┘
               ▼                                      ▼
        ┌────────────────────────────────────────────────────┐
        │   Postgres  (system of record, via Drizzle)         │
        │   users · coaches · submissions ·                   │
        │   submission_files · settings                       │
        └───────────────────────────┬────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
            ┌──────────────┐                 ┌──────────────────┐
            │   Resend     │ customer mail:  │ Vercel Cron      │
            │  (email)     │ code · receipt  │ nightly retention│
            │              │ · feedback ready│ sweep            │
            └──────────────┘                 └──────────────────┘
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
├── domains/    submission · checkout · verification · payment · upload ·
│               feedback · account · coach · settings · landing
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

CRON_SECRET="..."                                    # guards /api/cron/sweep; unset = the sweep REFUSES to run

RESEND_API_KEY="re_..."                              # unset = emails skipped, logged — but the
                                                     # flow can't complete without the code email
EMAIL_FROM="Baseball Sensei <hello@yourdomain.com>"
```

### `shared/config/` — the ONLY place `process.env` is read

Two files, split by **audience** so a client component never imports a module
full of secrets (see [structure.md §5](docs/design/structure.md)):

- `shared/config/env.ts` — server-only secrets (`DATABASE_URL`, `AUTH_SECRET`,
  Stripe secret, Blob token, Resend key, `CRON_SECRET`). Required values throw at
  point of use with a message naming the variable.

**Operator-tunable limits are not env vars.** Upload size, file count, and the two
retention windows live in the `settings` table and are edited at
`/admin/settings` — env is the developer's configuration, those are Yuta's
([ADR 012](docs/decisions/012-retention-and-operator-settings.md)).
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

**Payment is the last of four steps** ([ADR 009](docs/decisions/009-upload-before-payment.md)),
so by the time it runs the submission exists, the email is verified, and the files
are in.

Flow: `/start` step 4 calls the `createIntentAction` Server Action, which creates
a PaymentIntent carrying **only `metadata.submissionId`** and returns its
`clientSecret`. `<PaymentElement>` collects the card. On success the browser
confirms inline; a method needing a redirect (3-D Secure, wallets) comes back
through `GET /api/payment/return`, which confirms server-side. Either way Stripe
also fires `payment_intent.succeeded` to `POST /api/webhooks/stripe`. All paths
converge on `markSubmissionPaid()`, which is idempotent — whichever arrives first
flips the status to `new` and sends the receipt; the rest no-op.

### Object storage — uploads + feedback files

One `shared/storage` seam, two drivers behind a single interface: **local disk**
in dev (files under `STORAGE_DIR`), **Vercel Blob** in prod ([ADR 006](docs/decisions/006-object-storage-over-mux.md)).
The customer's uploads and the coach's feedback file both go through it, into a
folder per submission.

The seam also answers **`supportsDirectUpload`**, which is how the flow knows
whether the browser can upload straight to storage or must go through us
([ADR 011](docs/decisions/011-client-direct-uploads.md)).

- Upload: in production the browser uploads **straight to Blob** with a scoped,
  short-lived token from `/api/upload/blob`, then calls `/api/upload/complete` to
  record it; in dev the bytes go through `/api/upload` onto local disk. Each file
  gets a row in `submission_files`.
- Download: the coach's link resolves through `/api/files/[id]`, which checks the
  session and serves (or redirects to) the file — links stay stable and private
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

Each message lives in the domain that owns it, as `api/xEmail.ts`.

**The agreed set is six messages; three are built** — the full matrix, the gaps,
and the workflow change two of them require are pinned in
[`shared/email/_EmailDocumentation.md`](src/shared/email/_EmailDocumentation.md). Built today:

- **verification code** (`domains/verification/api/verificationEmail.ts`) — step 2
  of the flow;
- **receipt** (`domains/payment/api/paymentEmail.ts`) — on payment, listing every
  uploaded file by name and size;
- **feedback ready** (`domains/feedback/api/feedbackEmail.ts`) — when a coach
  marks a submission complete.

*(The old "video received" message was deleted with the flow rebuild: payment is
now last, so the receipt is the one confirmation and it already says what arrived.)*

**One caveat that changed with the flow:** best-effort is right for a receipt, but
the verification code is different in kind — the customer is *blocked* on it. A
missing `RESEND_API_KEY` no longer degrades honestly; it stops anyone buying.

**Escape customer-supplied values.** Filenames and player names land in HTML;
`paymentEmail.ts` has the helper and any new template needs the same treatment.

```typescript
// domains/<slice>/api/somethingEmail.ts
import { emailShell, sendEmail } from "@/shared/email";
import { site } from "@/shared/config/site";

export function sendSomething(to: string, link: string) {
  return sendEmail({
    to,
    subject: `${site.name} — something happened`,
    html: emailShell(
      "Something happened",
      `<p>Tap below to see it.</p>`,
      { label: "Open", url: link },
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

The system of record is one Postgres database, **five tables**, accessed through
Drizzle. **Column names live in exactly one place** — the Drizzle schema in
`shared/db` (surfaced to the domain via `domains/submission/api/`) — and a
migration is the only way they change. One home per fact.

### `submissions`

The spine. One row per request; every other domain orbits it. Created at **step 1
of the flow**, before verification, files, or payment — see
[ADR 009](docs/decisions/009-upload-before-payment.md).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, primary key | our own id — the linkage key everywhere |
| `customerEmail` | text | always lowercased on write and lookup |
| `playerName` | text | |
| `playerAge` | integer | |
| `focus` | enum | `Hitting` · `Pitching` · `Fielding` · `Catching` · `Other` |
| `customerNotes` | text | the customer's words, never overwritten |
| `internalNotes` | text | system messages + operator notes |
| `status` | enum | see lifecycle below |
| `emailVerifiedAt` | timestamptz, null | set when the 6-digit code is accepted; **the upload gate** |
| `verificationCodeHash` | text, null | bcrypt hash — the code itself is never stored |
| `verificationExpiresAt` | timestamptz, null | 10 minutes from issue |
| `verificationAttempts` | integer, default 0 | 5 before the code must be reissued |
| `stripePaymentId` | text, unique | PaymentIntent id — the webhook's idempotency key |
| `stripeAmount` | integer (cents) | |
| `paidAt` | timestamptz, null | |
| `assignedCoachId` | uuid, FK → `coaches.id`, null | set by the admin on assignment |
| `feedbackUrl` | text, null | storage key/URL for the coach's response. **Never swept** |
| `feedbackEmailedAt` | timestamptz, null | idempotency guard on the feedback email |
| `filesPurgedAt` | timestamptz, null | when the retention sweep removed the uploads |
| `submittedAt` | timestamptz, default `now()` | |
| `completedAt` | timestamptz, null | starts the retention clock |
| `updatedAt` | timestamptz | |

`customerNotes` and `internalNotes` stay separate so an operator can forward a
customer's words to a coach without hand-cleaning `[system]` lines out of them.

### `submission_files`

One row per file the customer uploaded. Replaced the single `videoUrl` column
when the flow moved to multi-file uploads.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid, primary key | the id in `/api/files/[id]` |
| `submissionId` | uuid, FK → `submissions.id`, cascade | indexed |
| `filename` | text | the customer's own name for it — display only, never a path |
| `contentType` | text | |
| `sizeBytes` | integer | |
| `fileUrl` | text, **null** | storage locator. **Goes null when swept — the row survives** |
| `uploadedAt` | timestamptz, default `now()` | |

The record outliving the bytes is deliberate: the portal and the receipt can
still say what was sent. `/api/files/[id]` answers **410 Gone**, not 404.

### `settings`

One row, always (`id` is fixed). The operator's knobs, edited at
`/admin/settings` — **not env vars**, because they belong to Yuta rather than to
a deploy ([ADR 012](docs/decisions/012-retention-and-operator-settings.md)).

| Column | Type | Default |
| --- | --- | --- |
| `priceCents` | integer | 8000 |
| `maxFileSizeMb` | integer | 50 |
| `maxFilesPerSubmission` | integer | 5 |
| `retainResolvedHours` | integer | 24 |
| `retainUnpaidHours` | integer | 24 |
| `updatedAt` | timestamptz | |

The **price is here, not `site.ts`** — the checkout charge and every place the
figure is shown read `settings.priceCents`, so the operator can change it without
a deploy and the card can't disagree with the charge.

### `status` lifecycle (enum, in order)

`draft → awaiting_payment → new → assigned → in_review → awaiting_approval → complete`

The customer flow writes the first three — `draft` at step 1, `awaiting_payment`
once the email is verified, `new` when the payment clears. The admin drives
`assigned` and `in_review` from the portal as he works the queue. A coach
delivering their file sets **`awaiting_approval`** — it does *not* reach the
customer yet — and Yuta approving it sets `complete`, **which fires the feedback
email** and starts the retention clock.

**`isPaid()` is the line that matters, and it is not "status === complete".**
Everything from `new` onwards has been paid for, including `awaiting_approval`.
Several places act destructively on the answer — discarding an unfinished
submission, deciding whether a redelivered Stripe webhook is a fresh payment — so
paid-ness is a `Record<SubmissionStatus, boolean>` in `domains/submission`, not a
list. Adding a status without answering the question is a compile error. It was a
list once, and `awaiting_approval` slipped through it.

**The canonical end-to-end path — inception to completion, with who drives each
stage, what changes, which email fires, and what is retained — lives in
[`domains/submission/_SubmissionDocumentation.md` §2](src/domains/submission/_SubmissionDocumentation.md).** It's the one place the whole arc is written down; refine it there
before changing any stage.

There is no "paid but no file yet" state any more: files arrive before payment,
so `awaiting_upload` was retired with the flow that needed it. The status lookup
collapses the middle states into calm customer-facing language — a parent doesn't
need to know their submission is "unassigned." The transition rules live in
`domains/submission`, not scattered across the UI.

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

Operator identity — **operators only, never customers.**

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

- `payment_intent.succeeded` → mark the submission paid (`new`) + send the
  receipt, which lists every uploaded file
- `payment_intent.payment_failed` → log for admin visibility; the submission
  stays in `awaiting_payment` with its files intact, so the customer can retry

**Signature verification:** `stripe.webhooks.constructEventAsync()` over the raw
body with `STRIPE_WEBHOOK_SECRET`. Verify before doing anything.

**Idempotency:** `markSubmissionPaid()` is idempotent — a submission already in a
paid status is returned untouched — so a Stripe retry, or the browser confirming
first, is a no-op. The receipt is gated on `justPaid`.

The intent names its submission in `metadata.submissionId`, written when the
intent was created. The id is looked up, never trusted to describe anything.

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

Uploads no longer gate on payment — payment comes after them
([ADR 009](docs/decisions/009-upload-before-payment.md)). They gate on the flow
cookie plus a verified email ([ADR 010](docs/decisions/010-verification-gates-upload.md)).

**In production the browser uploads straight to Vercel Blob**, because a
serverless request body is capped near 4.5 MB and a phone video is not
([ADR 011](docs/decisions/011-client-direct-uploads.md)):

| Route | Job |
| --- | --- |
| `POST /api/upload/blob` | issue a scoped, short-lived Blob client token (prod) |
| `POST /api/upload/complete` | record a file the browser uploaded directly (prod) |
| `POST /api/upload` | take the bytes through us onto local disk (**dev only**) |
| `POST /api/feedback/upload` | the coach's response — operator-gated |
| `GET /api/files/[id]` | download one uploaded file — operator-only; **410** once swept |
| `GET /api/feedback/[id]` | the coach's response — public once complete |
| `GET /api/payment/return` | where Stripe sends a 3-D Secure customer back |
| `GET /api/cron/sweep` | the nightly retention sweep — `CRON_SECRET` required |

See the endpoint table in [OPERATIONS.md](OPERATIONS.md).

---

## 10. Build Status

The original 8-sprint plan is retired — the platform pivot reshaped it, and git
holds the history. The build is **live in production** at `www.baseball-sensei.com`,
behind an HTTP Basic Auth gate while it's being finished.

**Built, deployed, and verified:**

- ✅ **Customer flow, four steps on `/start`** — player details → email
  verification (6-digit code) → multi-file upload → payment → confirmation.
  Walked end to end in a real browser 2026-07-30. *(This was the "in flight"
  signup/verification + upload-and-pay work; it has landed.)*
- ✅ **Landing page** — Audrey's approved design.
- ✅ **Foundation** — Postgres (Supabase in prod, Docker in dev), Drizzle
  migrations, seed.
- ✅ **Auth** — jose sessions, `admin`/`coach` roles, `proxy.ts` gate, `/login`,
  operator **change-password** (`/account`), plus a separate short-lived customer
  *flow* cookie (not an account).
- ✅ **Persistence + storage** — submissions and per-file rows on Postgres, files
  on the storage seam. **Direct-to-Blob in prod**, proxied to disk in dev.
- ✅ **Admin portal** — submissions queue with **status filters** and per-file
  downloads, coach management + **editing**, assignment, and **settings** (upload
  limits + retention).
- ✅ **Coach portal** — assigned reviews, per-file download, feedback delivery →
  complete → customer email.
- ✅ **Transactional email** — verification code, receipt with the file list,
  feedback ready. On **Resend** with the verified `baseball-sensei.com` domain.
- ✅ **Retention sweep** — nightly Vercel Cron, resolved and abandoned rules,
  customer uploads only.

**Remaining — the first two block the deployed app:**

- ✅ ~~Migrations `0001` + `0002`~~ — **applied** (verified 2026-07-30: `/start`
  renders, which needs the `settings` table, and step 1 submits, which needs
  `draft` in the enum).
- ✅ ~~`CRON_SECRET`~~ — **set and deployed** (`/api/cron/sweep` answers 401, not
  503).
- 🔴 **`BLOB_READ_WRITE_TOKEN` is unset, and it blocks the funnel.** Production
  serves `uploadMode: "proxy"`, so uploads fall back to local disk — which on a
  serverless host cannot work at all. Create the Blob store and redeploy.
- ⚠️ **Confirm `NEXT_PUBLIC_SITE_URL` is `https://www.baseball-sensei.com`** in
  Vercel. It builds the links inside customer emails *and* the redirect target
  for `/api/payment/return`. The flow cookie is host-only, so if this names the
  apex while customers browse `www`, a 3-D Secure customer returns **after being
  charged** to a host that doesn't send their cookie and sees "session expired".
  It's a `NEXT_PUBLIC_*` var, so it's inlined at build time — changing it needs a
  redeploy, not just a save.
- **Stripe** — production keys + the `payment_intent.succeeded` webhook, so real
  payments mark submissions paid ([OPERATIONS.md](OPERATIONS.md) §5–§6). The last
  thing before the funnel can take money.
- ⚠️ **The whole site is behind HTTP Basic Auth** (`BASIC_AUTH_USER` /
  `BASIC_AUTH_PASSWORD`). Nothing is publicly reachable until those are cleared
  and redeployed — worth remembering before anyone is invited to test.
- **Real coach content and photography** for the landing page — the current copy
  is wireframe placeholder and cannot go live as written.
- A **human test of the card field and 3-D Secure** — everything around it is
  proven, but a real card needs a real person.
- The **remaining three emails + Yuta's approval step**
  ([`shared/email/_EmailDocumentation.md`](src/shared/email/_EmailDocumentation.md)) — agreed, not built.
- Deferred: an in-app `/feedback/[id]` viewer, forgot-password (email reset),
  coach deactivation UI, resumable uploads across a reload, React Email,
  shadcn/ui.


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

- **Stripe retries failed webhooks.** Idempotency is critical — `markSubmissionPaid`
  no-ops on an already-paid submission; keep it so. A handler error returns 500 (safe).
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
  locator is stored on the file row; downloads resolve via `/api/files/[id]`
  (operator) and `/api/feedback/[id]` (public, complete-only).
- **In production the browser uploads straight to Blob.** Do not route a customer
  file through a Next.js route handler on Vercel — the request body is capped near
  4.5 MB ([ADR 011](docs/decisions/011-client-direct-uploads.md)).
- **Operator limits are in the database, not env.** File size, file count, and the
  two retention windows are edited at `/admin/settings`.
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
- **Submission** — One paid request from a customer for coaching feedback, carrying a **pack of files** (video, images, documents) reviewed together — not one video
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
