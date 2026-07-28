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
  submission/   the paid request for feedback — the spine noun, plus looking yours up
  payment/      paying for one (Stripe)
  upload/       getting the video to us (Mux)
  feedback/     the coach's response coming back
  landing/      the sales pitch
```

Read top to bottom, that's the business: *someone pays, uploads a video, a coach responds.*
That's rule #3 working — the tree names the domain, not the tech.

**`submission` is the noun every other domain orbits.** `payment` creates one, `upload`
attaches video to one, `feedback` completes one. They import its barrel; it imports none of
them. The graph stays acyclic and the arrows all point at the record.

---

## 3 · The slice — noun + verb, one folder

Worked example — `domains/submission/`:

```
submission/
  model/submission.ts          the type family + statuses     ┐ the NOUN — shape + logic
  model/submissionInput.ts     pre-payment input + validation ┘
  api/submissionSchema.ts      the Airtable codec               I/O — the storage seam
  api/submissionApi.ts         the queries
  ui/StatusLookup.tsx          "show me my submissions"         pixels — the verb
  index.ts                     the barrel (public surface)
  _SubmissionDocumentation.md
```

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

**The URL paths are a wire contract, not a naming choice.** `/api/webhooks/stripe` and
friends are configured in the Stripe, Mux, and Airtable dashboards. CLAUDE.md §5 once
proposed different paths (`/api/stripe/webhook`); renaming them now would mean re-pointing
every webhook — the single failure this project has already hit. They stay as they are.

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

---

## 5 · The invariants worth stating out loud

**Every Airtable column name lives in exactly one file** —
`domains/submission/api/submissionSchema.ts`. No other file in the codebase may contain a
quoted Airtable column name. If you're typing one, you're in the wrong file. *(Rule #2. This
is what Step 1 of the realignment bought.)*

**Every `process.env` read lives in exactly one file** — `shared/config/env.ts`. Everything
else imports `env`. *(Rule #2, same shape.)*

**`shared/` never imports a domain.** If you need to, the thing you're writing isn't shared.

---

## 6 · Naming

Adopted from `wrld-sandbox/Nomenclature.md` so the two codebases read alike.

| Kind | Convention | Example |
|---|---|---|
| Type / interface | `PascalCase`, singular | `Submission` · `SubmissionPatch` |
| Union member (a domain value) | `PascalCase` string literal, matching Airtable | `'Awaiting Upload'` · `'Hitting'` |
| Component (file **and** export) | `PascalCase` | `StartForm.tsx` → `StartForm` |
| Module file | `camelCase` | `submissionApi.ts` · `env.ts` |
| API client (file **and** export) | `camelCase` `xApi` | `submissionApi.ts` → `submissionApi` |
| Domain slice folder | `camelCase` | `submission` · `payment` |
| Segment folder | fixed lowercase set | `model` · `api` · `ui` · `lib` · `config` |
| Barrel | `index.ts` | |
| Slice doc | `_<Slice>Documentation.md` | `_SubmissionDocumentation.md` |
| id field | `xId`, `camelCase` | `muxAssetId` · `stripePaymentId` |
| boolean field | `isX` / `hasX` | `isFirstTransition` |
| ISO-string field | `xAt`, a `string` | `submittedAt` · `feedbackEmailedAt` |

**No hyphens in folders**, so a folder name reads as one concept.

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
