# Structure — domain-first FSD

How this codebase is organized. It's Feature-Sliced Design **tilted to domain-first**:
instead of splitting a concept across an `entities/` folder (its data) and a `features/`
folder (its behavior), **one domain slice holds both** — what the thing *is* and what you
*do* with it, in one place.

> Decided 2026-07-28 (Ben + Claude), adapting `wrld-frontend-sandbox/docs/design/structure.md`.
> Supersedes the `features/` + `integrations/` + `shared/` layout described in CLAUDE.md §5.
> Principles: [PRINCIPLES.md](../../PRINCIPLES.md) #3 (domain over layer) and #4 (noun + verb).

---

## 1 · The layers (top → bottom; imports flow **down** only)

| Layer | What it is | Depends on |
|---|---|---|
| **`app/`** | Next.js App Router — thin route files and API handlers | everything below |
| **`domains/`** | the **noun+verb slices** — the heart. Everything baseball-coaching-specific | other domains (acyclic) · shared |
| **`shared/`** | the domain-**less** foundation (SDK seams · UI primitives · config) | nothing above |

`shared/` is the floor (knows no domain); `app/` is the ceiling (a route, knows everything).

**Three layers, not five.** WRLD has `pages/` and `widgets/` between them. We don't, and
that's deliberate — see [PRINCIPLES.md](../../PRINCIPLES.md) § "What this codebase
deliberately does NOT adopt". The short version: `src/pages/` would be claimed by Next.js as
the Pages Router, and nothing here is a cross-domain widget.

---

## 2 · The domains

```
domains/
  submission/   the request for feedback — the spine noun, plus looking yours up
  checkout/     the four-step customer flow — sequence only; composes the panels below
  verification/ proving the customer can read the email they typed
  upload/       getting their files to us (storage)
  payment/      paying for one (Stripe) — the LAST step
  feedback/     the coach's response coming back
  account/      operator identity — who logs into the portal
  coach/        the reviewers, and assigning work to them
  settings/     the limits the admin tunes without a deploy
  landing/      the sales pitch
```

Read top to bottom, that's the business: *someone tells us about a player, proves their
email, uploads their clips, pays, and a coach responds.*
That's rule #3 working — the tree names the domain, not the tech.

**`submission` is the noun every other domain orbits.** `checkout` opens one, `verification`
unlocks it, `upload` attaches files to one, `payment` marks it paid, `feedback` completes
one. They import its barrel; it imports none of
them. The graph stays acyclic and the arrows all point at the record.

**`checkout` is the one slice shaped differently, on purpose.** It depends on four domains
and nothing depends on it, because its whole job is *ordering* them — it is the composition
root for the customer flow, the way a page is for `app/`. Each step's panel still lives with
the domain that owns its subject; `checkout` only decides what comes next. If a second slice
ever starts looking like this, that's a smell worth investigating rather than a pattern
worth copying.

---

## 3 · The slice — noun + verb, one folder

Worked example — `domains/submission/`:

```
submission/
  model/submission.ts          the type family + statuses     ┐ the NOUN — shape + logic
  model/submissionFile.ts      one uploaded file               │
  model/submissionInput.ts     what a customer types + rules   ┘
  api/submissionRow.ts         the row↔domain mapper            I/O — the storage seam
  api/submissionApi.ts         the queries
  api/submissionFileApi.ts     the file queries
  api/flowSession.ts           which submission this browser owns
  ui/PlayerInfoForm.tsx        step 1 of the flow               pixels — the verb
  ui/StatusLookup.tsx          "show me my submissions"
  index.ts                     the barrel (public surface)
  _SubmissionDocumentation.md
```

**Where slice docs live.** Every domain carries one. `shared/` normally carries a single doc
for the whole floor (`_SharedDocumentation.md`), because its seams are small and domain-less
— a seam earns its own `_XxxDocumentation.md` only when it owns a *decision* rather than just
a mechanism. `shared/email` is the one that does: "which messages exist, who receives them,
and which aren't built yet" is a product question no single domain can answer, so it lives
with the seam rather than in a `docs/` folder nobody opens while writing code. Don't split
the rest on principle.

**The segments** (a slice uses as few as it needs — rule #6):

| Segment | Holds | Rule |
|---|---|---|
| `model/` | types + logic (the domain, minus I/O and pixels) | almost always |
| `api/` | outbound I/O — HTTP clients, third-party calls, outbound email | when it talks to anything |
| `ui/` | React components | when it renders |
| `lib/` · `config/` | slice-local helpers · constants | as needed |

The segment vocabulary is **fixed**. Resist inventing one (`email/`, `services/`) — an
outbound email send is I/O, so it's `api/`. A fixed vocabulary is what makes any slice
navigable on sight.

**The floor that's always worth it:** separate **`ui/` from non-UI**. That's the
load-bearing split — logic stays testable and reusable without dragging components in.
`api/` vs `model/` is the next-best, marking the I/O boundary.

---

## 3b · Why `app/api/` exists — and what belongs in it

**The question this answers:** wrld-backend puts its HTTP surface *inside* the slice
(`domains/safety/report/routes.ts`), registered by a `server.ts` composition root. Why doesn't
ours?

**Because Next.js makes the file path the URL.** `app/api/webhooks/stripe/route.ts` *is*
`POST /api/webhooks/stripe` — there's no registration step to point elsewhere. Fastify lets
wrld choose where routes live; the App Router doesn't. So the folder stays where the
framework demands, and `app/api/` plays the part `server.ts` plays over there: **the
composition root, not a home for logic.**

That makes the rule about *contents* the important one, and it's wrld's rule verbatim — their
`routes.ts` is *"the HTTP surface: zod shape + the auth gate + status codes, thin."*

A route file may contain:

- reading the body (`.text()` for webhooks — signatures are computed over raw bytes)
- validating shape, and rejecting with 400
- calling **one or two domain functions**
- mapping the outcome to a status code

A route file may **not** contain:

- an SDK call, or an import from `shared/` — if a route needs Stripe, the domain needed it
- a decision about what data is safe to expose *(that's `PublicSubmission`)*
- a status transition, or anything about what an event *means*

**The test:** if you can't tell what the endpoint does from the domain function names it
calls, the logic is in the wrong file. Every route here is under 55 lines and none imports an
SDK — that's the invariant, and it's greppable.

**The URL paths are a wire contract, not a naming choice.** `/api/webhooks/stripe` is
configured in the Stripe dashboard. CLAUDE.md §5 once proposed a different path
(`/api/stripe/webhook`); renaming it would mean re-pointing the webhook — the single failure
this project has already hit. It stays as it is.

---

## 4 · Dependency rules

Enforced by convention and review, not lint — five domains is small enough to police by eye.
Revisit if it slips.

1. **Down-only across layers:** `app → domains → shared`. Never up.
2. **Within a slice:** `model(types) ← api ← model(logic) ← ui`. UI depends on logic; logic
   never imports UI.
3. **Cross-domain:** a domain may import **another domain's barrel**, never its internals,
   and the graph stays **acyclic**.
4. **`shared/` is domain-less** and imports nothing above it. That's what makes it shared —
   if something in `shared/` needs to know what a Submission is, it's in the wrong layer.
5. **Import the barrel, never deep.** `@/domains/submission`, not
   `@/domains/submission/model/submission`.

Rule 5 is what makes rule 6 of PRINCIPLES safe: because nobody imports internals, internal
layout can change freely.

**One plane is exempt from rules 3 and 5, and it's exempt by force** — the storage
declarations (`*Table.ts`, `*Enum.ts`), since 2026-08-05
([ADR 015](../decisions/015-schema-by-domain.md)):

6. **A declaration never imports a barrel** — not `@/db/schema`, not `@/shared/db`, not a
   slice's `index.ts`, nor anything that transitively reaches one. It imports other files
   **directly, across domains**: `coachesTable` imports `@/domains/account/model/usersTable`,
   and `submissionStatusEnum` imports the vocabulary it derives from in `model/submission.ts`.
   A foreign key is a compile-time reference no barrel can carry without closing a cycle through
   itself, and the failure mode is a table arriving `undefined` inside Drizzle with a stack trace
   naming neither file. Leaf model files are safe because nothing loops back through them.
7. **Everything above the plane keeps rules 1–5.** An `xApi.ts` imports `db` from `@/shared/db`
   and its own domain's table from `../model/xTable`. It reaches another domain's table at the
   declaration plane too — that's where tables are reached from, uniformly, whoever is asking.
8. **[`src/db/schema.ts`](../../src/db/schema.ts) is not a layer.** It's a manifest so
   drizzle-kit has one entry point, and it's outside the cake because it imports every domain,
   which rule 4 forbids anything in `shared/` from doing. Nothing in `src/` imports it; only
   `drizzle.config.ts` and `scripts/`.

---

## 5 · The invariants worth stating out loud

**Every stored column name lives in one place** — and since 2026-08-05 that place is the
**owning domain's `model/<x>Table.ts`**, not one shared schema file
([ADR 015](../decisions/015-schema-by-domain.md)). The invariant didn't change; its address
did. A column is still spelled exactly once, and
`domains/submission/api/submissionRow.ts` is still the only file that turns a DB row into a
domain object. A schema change is still a migration. *(Rule #2.)*

**Every `process.env` read lives in `shared/config/`** — `env.ts` for server-only secrets,
`publicEnv.ts` for the handful of `NEXT_PUBLIC_*` values the browser needs. Two files, split
by *audience*, so a client component never imports a module full of secret getters. Nothing
outside that folder reads `process.env`. *(Rule #2, with the split being a security boundary
rather than a convenience.)*

**`shared/` never imports a domain.** If you need to, the thing you're writing isn't shared.

---

## 6 · Naming

**Superseded by [`_NomenclatureLaw.md`](../../_NomenclatureLaw.md) on 2026-08-01** — the one
home for how things are spelled, including the settled `intake` / `response` vocabulary, the
retired words, and the grammar rule that lets one stem serve two axes. What follows is the
casing table it opens with, kept here because this doc is read on its own; **the law is the
source of truth** if the two ever disagree.

Adopted from `wrld-sandbox/_NomenclatureLaw.md` so the two codebases read alike.

| Kind | Convention | Example |
|---|---|---|
| Type / interface | `PascalCase`, singular | `Submission` · `SubmissionPatch` |
| Union member (a domain value) | string literal matching the DB enum | `'awaiting_payment'` (status) · `'Hitting'` (focus) |
| Component (file **and** export) | `PascalCase` | `StartForm.tsx` → `StartForm` |
| Module file | `camelCase` | `submissionApi.ts` · `env.ts` |
| API client (file **and** export) | `camelCase` `xApi` | `submissionApi.ts` → `submissionApi` |
| Domain slice folder | `camelCase` | `submission` · `payment` · `verification` |
| Segment folder | fixed lowercase set | `model` · `api` · `ui` · `lib` · `config` |
| Barrel | `index.ts` | |
| Slice doc | `_<Slice>Documentation.md` | `_SubmissionDocumentation.md` · `_EmailDocumentation.md` |
| id field | `xId`, `camelCase` | `muxAssetId` · `stripePaymentId` |
| boolean field | `isX` / `hasX` | `isFirstTransition` |
| ISO-string field | `xAt`, a `string` | `submittedAt` · `feedbackEmailedAt` |

**No hyphens in folders**, so a folder name reads as one concept.

### What landed in `shared/` on 2026-08-01, and why

Three additions, each because **two domains needed it and neither could own it**
without inverting a dependency (PRINCIPLES §5):

| | Why it can't live in a domain |
| --- | --- |
| `lib/flowWindow.ts` | `submission` owns the flow session, `verification` owns the code, and they expire on the same clock. Copied into both, one clock quietly becomes two |
| `email/client.ts` returning a boolean | the transport is domain-less; only the *caller* knows whether its customer is blocked on the message |
| `storage/index.ts` → `translationFileKey` | the four folders are a storage layout, and `submission` shouldn't spell object keys |

**`shared/` is not a junk drawer.** The test each of these passed: *would putting
this in a domain force another domain to import it?* If yes it belongs here; if
no it belongs in the domain that uses it.

One exception to camelCase files, forced from outside: **`src/app/` follows Next.js**, whose
router reserves `page.tsx`, `layout.tsx`, `route.ts`, and lowercase URL segments. Framework
conventions win in the framework's own directory.

**One stem per concept.** A domain folder and everything in it use **one** word, never two
forms of the same idea: `submission` · `submissionApi` · `SubmissionPatch` ·
`_SubmissionDocumentation`. A mix of `submission` and `submissions` is the exact smell this
kills.

---

## 7 · Where we came from

**Before Step 2 (2026-07-28):** files were grouped by tech role — `src/lib/` (eight
unrelated modules), `src/components/` (four), `src/types/`, plus `src/integrations/` added
during Step 1. To see "everything about payment" you opened `lib/stripe.ts`,
`lib/fulfillment.ts`, `app/api/checkout/route.ts`, and `app/start/start-form.tsx` — four
folders, related only by the reader's memory.

CLAUDE.md §5 had specified a layer-first FSD (`features/` + `shared/` + `integrations/`),
which would have been an improvement but kept the same fault: a concept's data and its
behavior in different trees.

**Step 2 adopted domain-first** after reading the WRLD sandbox, which had run the same
experiment at a larger scale and retired its own `entities/`-vs-`features/` split (their
follow pilot, 2026-07-12). We took the destination directly rather than repeating the
intermediate step.

The noun/verb *distinction* survives — it's the **segment** distinction now (`model/` and
`api/` = the noun's shape and reads; `ui/` = the verbs), co-located, not a top-level layer.
