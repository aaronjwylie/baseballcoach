# 007 — Operator portal + Postgres, retire Airtable

**Status:** Accepted (2026-07-29, Aaron) · **Major pivot** — reverses the "not a
SaaS platform" premise (CLAUDE.md §1), retires [ADR 001](001-airtable-as-db.md)
and [ADR 002](002-passthrough-holds-record-id.md) · **Needs the admin + Ben
sign-off on the operating-model change before build starts**

## Problem

The product is, at its core, a paid file exchange: customer pays and uploads a
video → a coach downloads and reviews it → the coach uploads feedback → the
customer downloads that. The coach reviews by **downloading and scrubbing
locally** ([ADR 006](006-object-storage-over-mux.md)).

The original design ran the operator side on **Airtable** specifically to *avoid
building an admin UI* — the whole "productized service, not a SaaS platform"
northstar rested on that. We've now decided the opposite: **the admin and the coaches
should log into a portal to manage and respond to submissions.**

Once you're building the admin UI, Airtable is redundant — the portal *is* the
interface, backed by a database we control. Keeping Airtable alongside a portal
would be double-bookkeeping.

## Decision

1. **Build a role-based operator portal** in the same Next.js app:
   - **Admin (the admin):** sees all submissions, manages coaches, assigns work,
     oversees the queue.
   - **Coach:** sees assigned submissions, downloads the video, uploads feedback,
     marks complete.
   - **Customers do not log in** — they still interact via paid links + the
     `/status` email lookup.
2. **Vercel Postgres is the database.** Drop **Airtable** and **Make.com**
   entirely.
3. **Storage stays Vercel Blob** ([ADR 006](006-object-storage-over-mux.md)) — now
   for *both* the customer's video and the coach's feedback file.

This is a deliberate move up the original "upgrade path," from thin-layer service
toward a real platform. It trades the lean-MVP speed the Airtable shortcut bought
for an operator experience the admin owns.

## What this retires / reworks

- **ADR 001** (Airtable is the database) — retired.
- **ADR 002** (`passthrough` holds the Airtable record ID) — retired; linkage
  moves to our own IDs.
- **ADR 003** (idempotent `ensureSubmission()`) — kept in spirit, but writes to
  Postgres instead of Airtable.
- **The feedback-ready Airtable automation + `/api/webhooks/airtable`** — retired;
  "feedback ready" is now a coach action in the portal that stores the file and
  fires the customer email directly.
- **CLAUDE.md §2 non-goals** — "no accounts / no coach portal / no admin
  dashboard / no real database" all flip.

## New data model (Postgres — sketch, finalize at build)

- **users** — `id`, `email`, `passwordHash` (or provider id), `role`
  (`admin` | `coach`), `createdAt`. Backs auth for the admin + coaches only.
- **coaches** — `id`, `userId`, `name`, `specialties`, `languages`, `active`.
- **submissions** — `id`, `customerEmail` (lowercased), `playerName`,
  `playerAge`, `focus`, `customerNotes`, `internalNotes`, `status`,
  `stripePaymentId`, `stripeAmount`, `videoUrl` (Blob), `videoKey`,
  `assignedCoachId` (FK → coaches), `feedbackUrl` (Blob), `feedbackEmailedAt`,
  `createdAt`, `updatedAt`.
- **Status enum:** `awaiting_upload → new → assigned → in_review → complete`
  (same lifecycle as before, now a real enum with a state machine the portal
  enforces).

An **ORM is now warranted** (previously banned) — **Drizzle** preferred
(lightweight, SQL-first, good on serverless) over Prisma; decide at build.

## Auth — open sub-decision

Don't hand-roll it. It's a small **two-role** portal (the admin + a few coaches), not
customer-facing auth at scale. Candidates:

- **Auth.js (NextAuth)** — in-house, free, no new vendor; more wiring.
- **Clerk** — fastest, polished; adds a vendor.
- **Supabase Auth** — bundles with Postgres if we used Supabase instead of Vercel
  Postgres; but we've chosen Vercel Postgres, so this would mix providers.

Leaning **Auth.js** to keep vendor count down (consistent with the reasoning that
picked Vercel Blob in ADR 006). Final call at build.

## Consequences

- **Scope.** This is the biggest change since kickoff — an admin dashboard, a
  coach dashboard, auth, roles, assignment flow, and DB migrations. It is *not*
  "whip up a backend in no time": the data layer is quick, the portal is most of
  a product. Sequence it as its own phase, not a sprint bolt-on.
- **Env vars.** Drop all `AIRTABLE_*`. Add `DATABASE_URL` (Vercel Postgres) and
  auth secrets (`AUTH_SECRET`, provider creds if Clerk). `BLOB_READ_WRITE_TOKEN`
  and the Stripe/Resend vars stay.
- **Deps.** Remove `airtable`/Airtable client code; add the Postgres driver +
  Drizzle. Auth library per the sub-decision above.
- **Still valid from Ben's realignment.** FSD structure, the naming sweep, Zod,
  and Stripe Elements ([ADR 005](005-stripe-elements-over-checkout.md)) all still
  apply — this pivot changes the *storage + operator* layer, not those.
- **Customer flow is unchanged** end to end (pay → upload → status → feedback by
  email); only the operator side and the persistence layer change.
- **Go-live / OPERATIONS.md** simplifies further: no Airtable base, no Make.com;
  add Postgres provisioning + seeding the first admin user.
- **Operating-model alignment.** the admin moves from a spreadsheet he knows to a
  portal we build. That's a client-experience change — **confirm with the admin before
  building**, and budget for basic operator onboarding.

## Sequencing

Build is **paused pending Aaron's word** (and the admin/Ben sign-off). When it starts,
this becomes the dominant workstream: schema + auth first, then the two portal
surfaces, then retire the Airtable code paths.
