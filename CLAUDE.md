@AGENTS.md

# CLAUDE.md — Baseball Coaching Platform (v1)

**Project Handoff — Version 4 Proposal**
**Repository:** https://github.com/aaronjwylie/baseballcoach
**Status:** Built through ~Sprint 4 and deployed. Realigning to this spec — see [§0](#0-where-this-project-actually-is).

This document is the single source of truth for Claude Code building this project. Read it fully before touching any code. When it conflicts with intuition, this file wins. When it conflicts with an SDK's docs, the SDK's docs win — but flag the discrepancy.

**Operational detail lives in [OPERATIONS.md](OPERATIONS.md)** — account setup, the Airtable base, webhook configuration, DNS, and the client's daily workflow. This file owns *intent*; that file owns *what to click*.

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
8. [Data Model (Airtable)](#8-data-model-airtable)
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

An online baseball coaching platform where parents pay to submit videos of their kids batting or pitching, and receive expert feedback from coaches based in Japan. The customer experience is smooth and professional; the client (Yuta) operates the workflow manually through Airtable with automation glue between his tools.

### The single most important sentence in this document

**This is a productized service with a thin custom layer, not a SaaS platform.**

Every architectural decision follows from that. The landing page, payment flow, and video upload are custom — they're what customers experience and where the brand lives. Everything else (submission tracking, coach assignment, feedback delivery) is handled by off-the-shelf tools (Airtable, Stripe, Mux, Make.com, Resend) wired together intelligently.

### The northstar goal

Give Yuta a functional, paying-customer-ready product at roughly 10% of the cost of a full SaaS platform, with a clear upgrade path as demand grows. The MVP validates the concept with ~10 early users before any further investment.

### What success looks like

- A customer can visit the landing page, pay via Stripe, upload a video, and receive coach feedback by email — all without friction
- Yuta can operate the entire workflow from Airtable in ~10–15 minutes per submission
- Coaches never log in anywhere; they receive videos by email and return feedback by email
- Operating costs are under ~$80 CAD/month at MVP volume
- The platform can run indefinitely at this scale, or grow into custom systems if demand emerges

### The lean validation philosophy

The client is personally funding this as a side project to validate demand before committing to larger investment. Every decision — scope, tools, architecture — should be evaluated against this. Resist the instinct to build for scale you don't have. Manual steps in the workflow are a feature at this stage, not a bug.

---

## 2. Non-Goals & Anti-Scope

The following are **intentionally not built**. If a request would require adding any of these, stop and flag it as out of scope before writing code. Do not silently expand scope.

- **User accounts with passwords, signup flows, or login screens.** Email-based identity only. Stripe captures the email at checkout; the status lookup page identifies returning users by email.
- **User dashboards** beyond a simple email lookup for submission status.
- **Coach login portal or coach-facing application.** Coaches receive videos by email and return feedback by email.
- **Custom admin dashboard.** Airtable is the admin tool.
- **Subscription billing.** Per-submission payment only.
- **Automated PDF report generation.** Coaches deliver PDFs manually if at all.
- **Custom video annotation tools** (drawing on frames, slow-motion analysis, side-by-side comparison).
- **Multilingual UI.** English at launch. Translation module is a separate future engagement.
- **Stripe Connect for coach payouts.** Yuta pays coaches manually outside the platform.
- **Native mobile apps.** iOS and Android are Phase 2.
- **Advanced analytics** beyond what Airtable provides natively.
- **Real-time coaching, chat, or live sessions.**
- **Japanese-specific payment methods** (Konbini, bank transfer). Stripe credit cards only.

If Yuta or Audrey asks for any of these mid-build, respond: "That's outside the scope of v1. It's on the upgrade path — happy to scope it as a change order."

---

## 3. Architecture

### System diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                       CUSTOMER-FACING (custom)                    │
│                                                                   │
│  Landing page → Submission form → Stripe Elements →              │
│  Mux upload page → Confirmation → Status lookup page             │
│                                                                   │
│  Runs on: Next.js on Vercel                                       │
└──────────┬────────────────────────────────────────┬───────────────┘
           │                                        │
           ▼                                        ▼
    ┌──────────────┐                        ┌──────────────┐
    │   Stripe     │                        │     Mux      │
    │  (payments)  │                        │   (video)    │
    └──────┬───────┘                        └──────┬───────┘
           │ webhook                                │ webhook
           ▼                                        ▼
    ┌────────────────────────────────────────────────────────┐
    │           Next.js API routes (Vercel)                  │
    │      Webhook handlers, email triggers, glue logic      │
    └───────────────────┬────────────────────────────────────┘
                        │
                        ▼
                ┌──────────────┐
                │   Airtable   │◄──── Make.com automations
                │  (database + │      (Stripe → Airtable,
                │   admin UI)  │       Mux → Airtable,
                └──────┬───────┘       status → email)
                       │
                       ▼
                ┌──────────────┐
                │    Resend    │──── Customer emails
                │ (email API)  │     (confirmation, feedback ready)
                └──────────────┘


         ┌───────────────────────────────────────────┐
         │       YUTA-OPERATED WORKFLOW              │
         │                                           │
         │  Reviews Airtable, assigns coach,         │
         │  emails coach, uploads feedback,          │
         │  marks status complete → email fires      │
         └───────────────────────────────────────────┘
```

### Key architectural principles

1. **The front door is custom, everything behind it is off-the-shelf.** Landing page, payment, upload — custom. Database, automation, admin — off-the-shelf.
2. **Airtable is the database.** Do not introduce Postgres, MySQL, Supabase, or any other real database.
3. **Make.com is the glue.** For automations that don't require app code (status change → email, admin notifications), Make.com handles it. For webhook receipt and processing, use Next.js API routes.
4. **Every custom-built feature should justify its existence.** If a $20/month tool can do it, use the tool.

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
| Video      | Mux direct upload          | Browser uploads straight to Mux, server never sees the file      |
| Database   | Airtable (via REST API)    | Treat as the "backend"                                           |
| Email      | Resend + React Email       | Templates as React components                                    |
| Automation | Make.com                   | External, documented in `/docs/operations.md` (create if needed) |
| Hosting    | Vercel                     | Free tier for staging, Pro for prod once needed                  |
| Domain     | GoDaddy                    | Yuta's registrar of choice, DNS points to Vercel                 |
| Repo       | Single Next.js repo        | Not a monorepo                                                   |

### Do NOT introduce

- A real database (Postgres, MySQL, Supabase) — Airtable is the database
- An ORM (Prisma, Drizzle) — there's nothing to ORM
- An auth library (NextAuth, Clerk, Supabase Auth) — no accounts in v1
- A state management library (Redux, Zustand) — React state is sufficient
- A UI library beyond shadcn/ui (MUI, Chakra) — Tailwind + shadcn only
- A custom email delivery setup (Nodemailer, SES) — use Resend
- CSS-in-JS libraries — Tailwind only

If any of these feels needed, the scope is wrong. Stop and flag it.

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

- **Every Airtable column name lives in one file** — `domains/submission/api/submissionSchema.ts`.
- **Every `process.env` read lives in one file** — `shared/config/env.ts`.

Each domain carries a `_XxxDocumentation.md` — its northstar, its honest current state, and
the dated trail of decisions that shaped it. **Read the slice's doc before changing the
slice.** They are kept true in the same commit as the code.

---

## 6. Environment Variables

All env vars go in `.env.local` for dev and Vercel project settings for prod. Document every one in `.env.example`.

```bash
# === Public (safe to expose to browser) ===
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_MUX_ENV_KEY="..."

# === Server-only ===
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."

MUX_TOKEN_ID="..."
MUX_TOKEN_SECRET="..."
MUX_WEBHOOK_SECRET="..."

AIRTABLE_API_KEY="pat..."           # Personal access token
AIRTABLE_BASE_ID="app..."
AIRTABLE_SUBMISSIONS_TABLE="Submissions"
AIRTABLE_COACHES_TABLE="Coaches"

RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="hello@yourdomain.com"

ADMIN_NOTIFICATION_EMAIL="yuta@yourdomain.com"
```

### env.ts — the ONLY place `process.env` is read

Create `src/config/env.ts` that validates every env var at startup using Zod. Fail loudly if any required var is missing. Import from `env.ts` everywhere else in the codebase — never read `process.env` directly.

```typescript
// src/config/env.ts (example structure)
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  // ... etc
});

export const env = envSchema.parse(process.env);
```

---

## 7. Third-Party Tool Integrations

This section describes what each tool does, why we chose it, and how to integrate it. Follow the SDK docs for exact API calls; use this as the conceptual guide.

### Stripe

**Role:** Payment processing.

**Integration approach:**

- Server: `stripe` SDK for creating PaymentIntents and verifying webhooks
- Client: `@stripe/react-stripe-js` + `@stripe/stripe-js` for the embedded `<PaymentElement>` component
- We use **Stripe Elements (embedded)**, not Stripe Checkout. This lets us keep the payment step on our own domain with our branding.

**Key flow:**

1. Client posts form data to `/api/stripe/create-intent`
2. Server creates PaymentIntent with metadata `{ customerEmail, customerName, playerName, playerAge, skillFocus }`
3. Client renders `<PaymentElement>` with the returned `clientSecret`
4. On success, redirect to upload page with payment intent ID in URL
5. Stripe fires `payment_intent.succeeded` webhook to `/api/stripe/webhook`
6. Webhook handler creates Airtable row with status "Awaiting Upload"

**Idempotency:** Stripe retries webhooks. Check if the Airtable row for this payment intent already exists before creating.

### Mux

**Role:** Video upload, storage, and streaming.

**Integration approach:**

- Server: `@mux/mux-node` SDK for creating direct upload URLs and verifying webhooks
- Client: `@mux/mux-uploader-react` for the browser-side upload component
- **Direct uploads** — the video goes straight from the browser to Mux, never through our server

**Key flow:**

1. Client posts to `/api/mux/upload-url` with the payment intent ID
2. Server verifies the payment intent is paid **by retrieving it from Stripe** — not by trusting our own Airtable row, which may be stale or forged
3. Server calls `ensureSubmission()` to get (or idempotently create) the Airtable row
4. Server creates a Mux direct upload URL with `passthrough: <airtableRecordId>`
5. Client renders `<MuxUploader>` with the upload URL
6. Upload completes → Mux fires `video.asset.ready` webhook to `/api/mux/webhook`
7. Webhook handler reads `passthrough`, fetches that Airtable record **directly by ID**, updates it with Mux Asset ID and Playback ID, changes status to "New"

**The `passthrough` field is critical** — it's how we link the video back to the submission. It holds the **Airtable record ID**, so the webhook does a direct record fetch rather than a `filterByFormula` search: cheaper, no formula-escaping surface, and unambiguous. (Earlier drafts of this document said it held the payment intent ID. The code's approach is better and wins — see [ADR 002](docs/decisions/002-passthrough-holds-record-id.md).) Fall back to a lookup on Mux Upload ID if `passthrough` is ever absent.

### Airtable

**Role:** Database and admin UI (Yuta's dashboard).

**Integration approach:**

- Use the `airtable` SDK or direct REST calls to the Airtable API
- Wrap all Airtable calls in `src/integrations/airtable/` — no raw calls elsewhere
- Rate limit: Airtable allows 5 requests per second per base. Cache reads where sensible; batch writes when possible

**Key operations:**

- Create submission row (from Stripe webhook)
- Update submission row (from Mux webhook, and from Make.com when status changes)
- Read submissions by email (for the status lookup page)
- Read a single submission by ID (for the feedback viewer)

**Email lookup rule:** Always normalize email to lowercase before writing to Airtable and before comparing on lookup. Airtable formulas are case-sensitive by default.

### Resend

**Role:** Transactional email delivery.

**Integration approach:**

- Server: `resend` SDK for sending
- Templates: React Email components in `src/emails/`
- Send domain must be verified in Resend before launch (DNS propagation takes time)

**Emails to send:**

- **Payment Confirmation** — triggered by Stripe webhook, sent immediately after payment
- **Video Received** — triggered by Mux webhook, sent when upload completes
- **Feedback Ready** — triggered by Make.com when Yuta changes status to "Complete"

**Note:** This document originally had Make.com sending the Feedback Ready email. **In the built system our app sends all three.** An Airtable automation watches for `Status = Complete` and calls `POST /api/webhooks/airtable`, which re-reads the record, sends the email, and ticks `Feedback Emailed` so a re-fire can't double-send. One less vendor in the path, and the email template lives with the other two.

### Make.com

**Role:** Automation glue between tools that don't need app code.

**Status: we haven't needed it, and probably shouldn't keep it.**

Three scenarios were budgeted:

1. ~~**Feedback Ready**~~ — built instead as an Airtable automation calling our own endpoint (see the Resend note above). Done, working, no Make.com involved.
2. **Abandoned Upload Reminder** — submissions stuck in "Awaiting Upload" for 24+ hours → reminder email. Not built. A native Airtable automation can do this.
3. **Admin Daily Digest** (optional) — daily summary for Yuta. Not built. Same.

Since the one scenario that justified the subscription turned out not to need it, **recommend dropping Make.com from the stack**: one fewer vendor, one fewer bill, one fewer place to look when something breaks. That's squarely on-northstar. Flagged for Ben — see [OPERATIONS.md](OPERATIONS.md#make-com).

If Make.com does stay, Claude Code never touches it directly — it only keeps the Airtable schema and webhook contracts compatible with what Make.com reads.

### Vercel

**Role:** Hosting for the Next.js app.

**Integration approach:**

- Connect the GitHub repo to Vercel via the Vercel dashboard
- Set env vars in Vercel project settings (separate values for Production and Preview)
- Push to `main` → deploys to production
- Push to any branch → deploys a preview URL for client review

**Custom domain:** Configure in Vercel dashboard, point GoDaddy DNS to Vercel's provided A/CNAME records.

---

## 8. Data Model (Airtable)

Airtable is the database. The schema lives in one base with two tables.

### Submissions table

**Field names are load-bearing.** They are declared in exactly one place — [`src/domains/submission/api/submissionSchema.ts`](src/domains/submission/api/submissionSchema.ts) — and nowhere else in the codebase may contain a quoted Airtable column name. A rename is that one file plus a migration on the client's base.

| Field Name          | Type                        | Written by                                  |
| ------------------- | --------------------------- | ------------------------------------------- |
| Submission ID       | Autonumber (primary)        | Airtable — read-only to the app             |
| Customer Email      | Single line text            | App — always lowercased on write and read   |
| Player Name         | Single line text            | App                                         |
| Player Age          | Number (integer)            | App                                         |
| Focus               | Single select               | App — Hitting / Pitching / Fielding / Catching / Other |
| Customer Notes      | Long text                   | App — the customer's words, never overwritten |
| Internal Notes      | Long text                   | App (system messages) + Yuta                |
| Status              | Single select               | App, then Yuta — see below                  |
| Submitted At        | Created time                | Airtable — read-only to the app             |
| Stripe Payment ID   | Single line text            | App                                         |
| Stripe Amount       | Currency (CAD)              | App                                         |
| Mux Upload ID       | Single line text            | App                                         |
| Mux Asset ID        | Single line text            | App (Mux webhook)                           |
| Mux Playback ID     | Single line text            | App (Mux webhook)                           |
| Assigned Coach      | Single line text            | **Yuta** — app reads only                   |
| Feedback Video URL  | URL                         | **Yuta** — the coach's Loom/video link      |
| Feedback Emailed At | Date (with time)            | App — idempotency guard on the feedback email |

Three columns are **read-only to the app** and the codec refuses to write them even if a caller asks: `Submission ID` and `Submitted At` are computed by Airtable, and `Assigned Coach` is Yuta's to set.

`Stripe Payment ID` holds a Checkout Session ID today and a PaymentIntent ID once the Elements rebuild lands. The name describes the role, not the Stripe object, so that change needs no second migration.

**Splitting `Customer Notes` from `Internal Notes` is deliberate.** They were one column, which meant system messages (`[system] Mux reported an error…`) interleaved with what the parent wrote — so nothing could be forwarded to a coach without being cleaned by hand first.

### Status values (exact strings, in order)

1. `"Awaiting Upload"` — Payment succeeded, video not yet uploaded
2. `"New"` — Video uploaded, ready for coach assignment
3. `"Assigned"` — Coach assigned by Yuta, awaiting review
4. `"In Review"` — Coach is working on feedback
5. `"Complete"` — Feedback delivered

The app only ever writes the first two. `Assigned` and `In Review` are Yuta's to set as he works the queue, and `Complete` is what triggers the feedback email. That split is expressed in the type system as `AppWrittenStatus`.

The status lookup collapses `New`, `Assigned`, and `In Review` into calm customer-facing language — a parent doesn't benefit from knowing their video is "unassigned."

**Never invent new status values in code without updating Airtable and the automations that watch it.**

### Coaches table — not built, deliberately

**No Coaches table exists.** `Assigned Coach` is a plain text field Yuta types into.

The table below is the upgrade path, not a to-do. A linked record buys referential integrity, per-coach filtered views, and specialty-based routing — none of which matter while there are three coaches Yuta knows by name. Build it when he's routing enough volume that typing a name is error-prone, or when something in the app needs to *answer questions about coaches* rather than just display one. Until then it's an empty table and a join.

When it does get built, `Assigned Coach` changes from text to a linked record, and the pitfall in §12 applies — linked fields return arrays of record IDs, so denormalize the name into a formula field rather than doing a second fetch per row.

| Field Name         | Type                | Notes                     |
| ------------------ | ------------------- | ------------------------- |
| Coach Name         | Single line text    | Primary field             |
| Email              | Email               | For Yuta to contact       |
| Specialties        | Multiple select     | Match the Focus options   |
| Languages          | Multiple select     | "English", "Japanese"     |
| Active             | Checkbox            | Toggle                    |
| Linked Submissions | Link to Submissions | Reverse link auto-created |

---

## 9. Webhook Contracts

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

> **Progress against this plan.** Sprint 0 ✅ · Sprint 1 ⚠️ restructured to an interim wireframe, awaiting Audrey's design · Sprint 2 ✅ Elements (Step 5), verified against real Stripe in test mode · Sprint 3 ✅ · Sprint 4 ⚠️ raw-HTML templates, not React Email; **Resend has no verified domain, so mail only reaches the account owner** · Sprint 5 ✅ status lookup, rate-limited · ⚠️ feedback viewer outstanding · Sprint 6 ✅ (Airtable automations, not Make.com) · Sprint 7 ⚠️ mobile upload still untested on real devices · Sprint 8 not started.
>
> The realignment steps in [§0](#0-where-this-project-actually-is) run before picking the sprint plan back up.

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
9. Any Airtable schema changes are documented in section 8 of this doc
10. Commit message is clear; PR description summarizes what changed and what was tested

---

## 14. When to Stop and Ask

Stop and flag for human review if:

- A request would require adding something from section 2 (Non-Goals)
- Airtable field names, types, or options need to change
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
- **Airtable base** — The single Airtable workspace holding Submissions and Coaches tables
- **The Team** — Ben (frontend), Aaron (backend advisory), Audrey (design + client relations)

---

## Related Documents

- **[OPERATIONS.md](OPERATIONS.md)** — Account setup, the Airtable base, webhook configuration, Resend domain, Vercel, DNS, go-live checklist, and Yuta's daily workflow
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
