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
10. [Build Timeline & Sprint Plan](#10-build-timeline--sprint-plan)
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

**Status:** in build, on a feature branch, local-first (dockerized Postgres +
local storage) ahead of porting to Vercel.

### What's built and working

Landing page, player-info form, payment, Mux upload, status lookup, three
transactional emails, and all webhook glue. `tsc --noEmit` passes clean. Roughly
Sprints 0–4 plus most of 5, minus the feedback viewer.

### Where the code beat this spec — the code wins

These were considered improvements, not drift. **Do not "fix" them back toward
the text.** Each has an ADR in [docs/decisions/](docs/decisions/).

| Divergence | Why the code is right |
| --- | --- |
| Mux `passthrough` holds the **Airtable record ID**, not the payment ID (§7 said payment ID) | Turns the webhook's row lookup into a direct fetch by ID instead of a `filterByFormula` search — cheaper, no escaping risk, no ambiguity |
| Row creation is a shared `ensureSubmission()`, called by **both** the Stripe webhook and the upload endpoint | Handles a race this spec never addressed: the customer returning from payment before the webhook lands |
| The upload endpoint verifies payment **against Stripe directly**, not against our Airtable row (§7 said Airtable) | Can't mint an upload URL against a forged or unpaid session, even if Airtable is stale |
| Transactional email is best-effort and never throws into a webhook | A Resend outage would otherwise make Stripe retry-loop a payment that already succeeded |

### Where the code diverges and must be realigned

| Divergence | Resolution |
| --- | --- |
| ~~Stripe **hosted Checkout** instead of Elements (§4)~~ | ✅ Step 5 — Elements, both steps on one route. Verified against real Stripe; the `<PaymentElement>` UI still needs a browser check |
| ~~**3 statuses** instead of 5 (§8)~~ | ✅ Step 1 — five statuses, with the middle three owned by Yuta |
| ~~Flat `src/lib/` + `src/components/` instead of FSD (§5)~~ | ✅ Step 2 — domain-first, see [PRINCIPLES.md](PRINCIPLES.md) |
| ~~Hand-rolled validation instead of **Zod** (§11)~~ | ✅ Step 3 — one schema, both sides |
| ~~No rate limit on the status lookup (Sprint 5)~~ | ✅ Step 3 — 5/IP/min, in-memory and knowingly partial |
| No `/feedback/[id]` viewer (Sprint 5) | Build, once the wireframe lands |
| Raw-HTML email strings instead of **React Email** (§4) | Open — decide during the email pass |
| Hand-rolled `ui.tsx` primitives instead of **shadcn/ui** (§4) | Open — decide when the wireframe lands |

### Nomenclature — the spine

One concept used to carry three names across the stack: the coaching focus was
`focus` in code, `Sport` in Airtable (holding values like `"Hitting"`), and
`Skill Focus` in this document. Column names appeared as bare string literals in
six files, so a rename in the base broke the app silently in six places.

**The rule now: one name per concept, declared once.**

- [`domains/submission/model/submission.ts`](src/domains/submission/model/submission.ts) —
  the domain vocabulary. Knows nothing about Airtable. A property here is spelled
  the same way in the form, the API, and the UI.
- [`domains/submission/api/submissionSchema.ts`](src/domains/submission/api/submissionSchema.ts) —
  the **only** file containing Airtable column names, plus the codec between the
  two. If storage ever moves off Airtable, this is what changes.

**No other file may contain a quoted Airtable column name.** That's the
invariant the whole architecture rests on — if you're typing one, you're in the
wrong file.

### Sequencing

0. ✅ **Reconcile the docs** so the source of truth is true
1. ✅ **One name per concept** — schema, codec, 5 statuses, notes split
2. ✅ **Domain-first move** — `domains/` + `shared/`, per-slice docs
3. ✅ **Zod** + the status-lookup rate limit
4. ✅ **Interim landing restructure** — against the reference wireframe
5. ✅ **Stripe Elements** — built and verified against real Stripe (test mode)
6. **Reformat to Audrey's approved design** — when it can be read

Steps 0–3 were the wireframe-independent block; Step 5 is too.

> **Verified end to end on 2026-07-29** against a scratch base
> (`appQpITLd7VoG2KT5`, 17/17 fields): the status lookup, all three webhooks,
> their idempotency guards, and the seed tooling. Details in the slice docs.
>
> **Yuta's own base has NOT been migrated.** It still carries the pre-Step-1
> schema, so the deployed app cannot read or write it. That migration is
> `--migrate`, not `--create` — runbook at
> [OPERATIONS.md §4b](OPERATIONS.md#4b-migrating-an-existing-base).

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
├── domains/    submission · payment · upload · feedback · landing
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

- Server: `resend` SDK. Templates as React Email components under `shared/email`.
- **Best-effort by design:** a send failure logs and never breaks a webhook or a
  portal action ([ADR 004](docs/decisions/004-best-effort-email.md)). If
  `RESEND_API_KEY` is unset, sends are skipped and logged — honest degradation.
- Three messages: **payment received** (Stripe webhook), **video received** (on
  upload complete), **feedback ready** (when a coach marks a submission complete
  in the portal — no external automation).

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

> **Being reworked with the build.** The **Stripe** webhook stays but now writes
> the submission row to **Postgres** (not Airtable). The **Mux** webhook is
> **removed** — object storage replaces it ([§7](#7-third-party-tool-integrations)),
> and "upload complete → status `new`" becomes an app callback, not a Mux event.
> The raw-body signature-verification rule below still applies to Stripe. Exact
> URLs are the wire contract in [structure.md §3b](docs/design/structure.md);
> this section is rewritten in the same commit as the reworked handlers.

### Stripe webhook

**Endpoint:** `POST /api/stripe/webhook`

**Events handled:**

- `payment_intent.succeeded` → create Airtable row with status "Awaiting Upload"
- `payment_intent.payment_failed` → log for admin visibility (no Airtable row created)

**Signature verification:** Use `stripe.webhooks.constructEvent()` with the raw request body and `STRIPE_WEBHOOK_SECRET`. Verify BEFORE parsing.

**Idempotency:** Check if a row with this `Stripe Payment ID` already exists in Airtable. If yes, return 200 without creating a duplicate.

**Response:** Return `200` quickly (under 5 seconds). Long-running work (email send, Airtable write) should complete inside the 30s timeout but be structured to fail gracefully.

### Mux webhook

**Endpoint:** `POST /api/mux/webhook`

**Events handled:**

- `video.asset.ready` → update Airtable row with Mux IDs, change status to "New"
- `video.asset.errored` → update row status, log for admin
- `video.upload.cancelled` → log

**Signature verification:** Use `Mux.Webhooks.verifyHeader()` with the raw body and `MUX_WEBHOOK_SECRET`.

**Passthrough retrieval:** Read `passthrough` from the asset payload — this contains the Stripe payment intent ID that links the video back to the paying customer.

**Idempotency:** Check if the row already has `Mux Asset ID` populated. If yes, return 200 without re-updating.

### Raw body handling (critical)

Next.js App Router API routes need special handling for webhook signature verification. The Stripe and Mux SDKs need the **raw, unparsed body** to verify signatures. Use `await req.text()` and pass the string directly to the verification function.

```typescript
// Example pattern
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );
  // ... handle event
}
```

---

## 10. Build Timeline & Sprint Plan

Total: **4–6 weeks from kickoff to soft launch.**

> **This plan predates the [§0 platform pivot](#0-where-this-project-actually-is) and is being reworked.**
> The customer-funnel sprints (landing, payment, upload, status) largely stand;
> what changes is the layer beneath — Airtable/Mux/Make.com give way to Postgres,
> object storage, and Auth.js — plus new work for the **admin and coach portals**.
> The live build sequence is: docs sweep → dockerized Postgres + Drizzle schema →
> Auth.js → move persistence/storage off Airtable/Mux → the two portals → retire
> the old code. The sprint entries below are kept for the customer-funnel detail
> that's still accurate; treat §0 + the ADRs as the current plan of record.

### Sprint 0 — Project Initialization (Day 1)

**Deliverable:** Empty repo → running Next.js app with all dependencies, dev tooling, and env validation.

Tasks:

1. Initialize Next.js 14+ with App Router, TypeScript, Tailwind
2. Install shadcn/ui, configure Slate base color and CSS variables
3. Install core dependencies (Stripe SDK, Mux SDK, Airtable, Resend, React Email, React Hook Form, Zod, lucide-react, clsx, tailwind-merge)
4. Install dev dependencies (Prettier, prettier-plugin-tailwindcss, ESLint config)
5. Create `.env.example` with every variable documented, no values
6. Create `.env.local` (gitignored) with placeholder values
7. Set up `src/config/env.ts` with Zod validation of env vars
8. Configure `tsconfig.json` with `"strict": true`
9. Set up the FSD folder structure from section 5
10. Initial commit → push → Vercel connects and does first preview deploy

**Checkpoint:** App runs on `npm run dev`. Tailwind works. shadcn/ui can install a Button. Env vars load. Preview deployment lives on Vercel.

### Sprint 1 — Landing Page & Visual Design (Week 1, Days 2–5)

**Deliverable:** Polished, responsive landing page with branding.

Tasks:

1. Collect brand assets and copy from Audrey (Figma designs, wordmark logo, colour palette, typography)
2. Set up design tokens in `tailwind.config.ts` and `globals.css`
3. Build the root layout (`app/layout.tsx`) — metadata, fonts, header, footer
4. Build landing page sections in `features/landing/`:
   - Hero (headline, subheadline, CTA)
   - How it works (3 steps: Submit → Review → Receive)
   - Coach bios (cards with photos, names, credentials, specialty tags)
   - Pricing (single card, per-submission model)
   - FAQ (accordion)
   - Footer CTA
5. Compose them in `app/page.tsx`
6. Ensure smooth-scroll on nav anchor links
7. Make everything responsive (test 375px, 768px, 1280px)
8. Set up basic SEO (title, description, OG image)

**Checkpoint:** Landing page deployed to Vercel preview. Audrey and Yuta review and approve. All CTAs link to `/submit`.

### Sprint 2 — Submission Form & Stripe Payment (Week 2, Days 6–9)

**Deliverable:** User can enter info, pay successfully, and land on a placeholder upload page.

Tasks:

1. Build `/submit` page with React Hook Form + Zod:
   - Customer name (required, 2–100 chars)
   - Customer email (required, valid, lowercased on submit)
   - Player name (required)
   - Player age (required, 5–18)
   - Skill focus (required, radio: Batting / Pitching)
2. Create `POST /api/stripe/create-intent`:
   - Validate with Zod
   - Create Stripe PaymentIntent with all customer/player data in metadata
   - Return `{ clientSecret, paymentIntentId }`
3. Build `/submit/payment` with `<PaymentElement>`:
   - Show order summary
   - Handle submit via Stripe.js
   - On success → redirect to `/submit/upload?payment=<id>`
   - On failure → show error, retry
4. Build `POST /api/stripe/webhook`:
   - Verify signature with raw body
   - On `payment_intent.succeeded`:
     - Idempotency check
     - Create Airtable row with status "Awaiting Upload"
     - Store all metadata + payment ID + amount
   - Respond 200 quickly

**Test card:** `4242 4242 4242 4242`, any future date, any CVC.

**Checkpoint:** Test payment creates an Airtable row with status "Awaiting Upload". Webhook signature verifies. Customer email is lowercased.

### Sprint 3 — Mux Video Upload (Week 3, Days 10–13)

**Deliverable:** After payment, customer uploads a video and the Airtable row updates to "New".

Tasks:

1. Create `POST /api/mux/upload-url`:
   - Verify the payment intent ID is real and paid (check Airtable)
   - Call Mux to create a direct upload URL
   - Set `passthrough` to the payment intent ID
   - Return the upload URL to the client
2. Build `/submit/upload`:
   - Verify the payment intent in URL is valid
   - Render `<MuxUploader>` from `@mux/mux-uploader-react`
   - Style the upload progress UI with Tailwind
   - On upload completion, redirect to `/submit/confirmation`
3. Build `POST /api/mux/webhook`:
   - Verify signature with raw body
   - On `video.asset.ready`:
     - Idempotency check (row not already populated)
     - Read `passthrough` for the payment intent ID
     - Find the matching Airtable row
     - Update with Mux Asset ID, Playback ID, status → "New"
     - Trigger admin notification email to Yuta
4. Build `/submit/confirmation`:
   - Friendly thank-you message
   - Show submission summary
   - Link to status lookup page

**Checkpoint:** End-to-end: pay → upload → Airtable row goes "Awaiting Upload" → "New" with Mux IDs populated. Yuta gets an admin notification.

### Sprint 4 — Email Templates & Resend (Week 3–4, Days 14–15)

**Deliverable:** Customers receive professional emails at each workflow milestone.

Tasks:

1. Set up Resend account, verify sending domain (Ben does this in OPERATIONS.md)
2. Build email templates in `src/emails/` using React Email:
   - `PaymentConfirmation.tsx` — "We received your payment, please upload your video"
   - `VideoReceived.tsx` — "Your video is in! A coach will review it shortly"
   - `FeedbackReady.tsx` — used by Make.com, but built as a React Email template first
3. Build `src/integrations/resend/send.ts`:
   - Renders React Email template to HTML
   - Sends via Resend
   - Logs success/failure
4. Hook into webhook handlers:
   - Stripe `payment_intent.succeeded` → send Payment Confirmation
   - Mux `video.asset.ready` → send Video Received
5. Consistent brand styling across all emails (shared layout component)

**Checkpoint:** Test customer receives two emails in the right order. Render check passes in Gmail, Outlook, Apple Mail.

### Sprint 5 — Status Lookup & Feedback Viewer (Week 4, Days 16–18)

**Deliverable:** Returning customers can check their submissions and view feedback when ready.

Tasks:

1. Build `/status` page:
   - Simple form: email input
   - POST to `/api/submissions/lookup`
   - API fetches all submissions for that email (normalized lowercase)
   - Render list with status badges
   - If status is "Complete", show a link to the feedback viewer
2. Build `/feedback/[id]` page:
   - Fetch the submission from Airtable by ID
   - Display: coach name, feedback video (Mux player or Loom embed), PDF (if any), coach notes
   - Access control note: this page is accessible to anyone with the URL. Acceptable for v1 (URL contains submission ID, not easily guessable). Document this trade-off.
3. Rate limit the status lookup (5 requests per IP per minute) to prevent scraping

**Checkpoint:** Customer can enter email → see submissions → click through to feedback when ready → view coach's response.

### Sprint 6 — Airtable & Make.com Integration Glue (Week 4–5, Days 19–20)

**Deliverable:** All automated flows wired up. Yuta can operate the workflow manually.

Tasks:

1. Confirm both webhook handlers (Stripe + Mux) reliably write to Airtable
2. Document the webhook contracts in OPERATIONS.md for Make.com to consume
3. Build the admin notification trigger: when Mux webhook completes, send an email to `ADMIN_NOTIFICATION_EMAIL` with a link to the Airtable record
4. Make.com scenarios (Ben configures manually per OPERATIONS.md):
   - Feedback Ready → customer email
   - Abandoned Upload reminder
   - Admin daily digest (optional)
5. Test the full loop end-to-end: payment → upload → admin notified → Yuta assigns coach in Airtable → uploads feedback → changes status to "Complete" → customer receives email → views feedback

**Checkpoint:** A test submission processes end-to-end with only Yuta's manual Airtable interaction. No developer intervention required.

### Sprint 7 — Polish, QA, Launch Prep (Week 5, Days 21–25)

**Deliverable:** Production-ready application.

Tasks:

1. **Error handling.** Every API route returns clear error responses. Every page handles loading and error states. Error boundaries on critical flows.
2. **Idempotency.** Confirm all webhook handlers are idempotent (verified in Sprints 2 and 3).
3. **Logging.** Use Vercel's built-in logging. Structured logs (`console.log(JSON.stringify({...}))`). Log every webhook receipt, Airtable write, email send.
4. **Accessibility.** Run Lighthouse audit. Fix a11y issues (alt text, form labels, focus states, contrast).
5. **Mobile.** Test full flow on real iPhone and Android. Mux upload from mobile is the highest-risk area.
6. **Edge cases:**
   - User pays but abandons upload → email reminder after 24 hours (Make.com scenario)
   - Mux processing fails → admin alert
   - User enters wrong email at checkout → no recovery in v1, document
   - Duplicate submissions → allowed (each is a paid transaction)
7. **Performance.** Lighthouse >90 on Performance, Accessibility, Best Practices, SEO for the landing page.
8. **Security review.**
   - All webhook signatures verified
   - Server env vars never exposed to client
   - Status lookup rate-limited
   - Airtable formula injection protection
9. **Client training.** Document Yuta's daily workflow in OPERATIONS.md.
10. **Soft launch checklist.** Run through with Ben and Audrey before opening to real users.

**Checkpoint:** All checks pass. Ready for Sprint 8 deployment.

### Sprint 8 — Deploy to Production (Day 26)

**Deliverable:** Live production platform.

Tasks:

1. Create production Vercel project (or promote existing preview to production)
2. Set all production env vars — live Stripe keys, live Mux keys, prod Airtable base, prod Resend domain
3. Configure custom domain via Vercel + GoDaddy DNS
4. Update Stripe webhook endpoint to production URL
5. Update Mux webhook endpoint to production URL
6. Update Make.com scenarios to point to prod Airtable base
7. Test full flow with a real $1 test transaction (refund afterward)
8. Open to soft launch (Yuta invites first cohort of test users)

**Checkpoint:** Production is live. First real submission processes cleanly.

> **Handoff runbook:** For the step-by-step go-live and client-handoff
> procedure — transferring the app to the client's own Vercel/GitHub and
> third-party accounts, every env var, webhook re-point, end-to-end test, and
> dev teardown — see [OPERATIONS.md](OPERATIONS.md).

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

Read this section before coding. These have bitten similar projects.

> The **Airtable** and **Mux** subsections are historical (both are being
> retired — [§0](#0-where-this-project-actually-is)). The **Webhooks**, **Stripe**,
> **Email**, and **Next.js App Router** notes still apply. Postgres, Drizzle,
> storage, and Auth.js pitfalls get added as those pieces land.

### Webhooks

- **Stripe and Mux retry failed webhooks.** Idempotency is critical — check if the work is done before doing it.
- **Respond 200 quickly.** Under 5 seconds ideally. Long work should still finish inside 30s but structure defensively.
- **Signatures must be verified.** Without this, anyone can spoof events. Use the official SDK verification functions.
- **Use the raw body for verification.** `await req.text()`, then pass the string. Do NOT `req.json()` first.

### Airtable

- **Rate limit: 5 requests/sec per base.** Cache reads where possible, batch writes.
- **Fields can be undefined if empty.** Always handle missing fields defensively (`row.fields["Coach Notes"] ?? ""`).
- **Linked record fields return arrays of IDs.** To get coach name, either second fetch or use an Airtable formula field to denormalize.
- **Email lookups must normalize case.** Airtable filters are case-sensitive.
- **Field names are strings in code.** Rename a field in Airtable → break the code. Track this in code review.

### Mux

- **Uploads happen client-side, directly to Mux.** Your server never sees the file. Trust Mux for validation.
- **The `passthrough` field is how you link uploads to payments.** Store the payment intent ID there.
- **Assets take a few seconds to be "ready" after upload completes.** Wait for `video.asset.ready`, not `video.upload.asset_created`.

### Stripe

- **Test mode and live mode use completely separate keys.** Never mix them.
- **Test-mode webhook secrets fail in prod.** Set up two webhook endpoints in Stripe dashboard.
- **PaymentIntent metadata has a 500-character limit per value.** Don't stuff JSON blobs in there.

### Email

- **Resend requires domain verification before sending from a custom domain.** Set this up early — DNS can take hours.
- **React Email templates render at build/send time.** Preview them by rendering to HTML and opening in a browser.
- **Gmail clips long emails.** Keep transactional emails focused — link out rather than embedding everything.

### Next.js App Router

- **Server components can't use browser APIs** (window, localStorage). Mark as `"use client"` if needed.
- **API routes use `route.ts` with named exports** (`export async function POST(req)`).
- **Fetch data in server components when possible.** Better performance, no loading flicker.

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
