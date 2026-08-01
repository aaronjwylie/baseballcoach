# PRINCIPLES — how this codebase is built

> **Canonized 2026-07-28 (Ben + Claude).** Adapted from the WRLD sandbox's constitution
> (`wrld-sandbox/PRINCIPLES.md`), which earned these rules on a much larger codebase. This
> file is the *why*; [`docs/design/structure.md`](docs/design/structure.md) is the *how it's
> laid out*; [CLAUDE.md](CLAUDE.md) is the *what we're building and for whom*.
>
> **If a principle here can't be honored by a piece of code, that's a signal the model is
> wrong — fix the model, not the code.** Friction is information.

---

## The two laws that outrank everything

**1 · Build exactly as much platform as the coaching workflow needs — and no more.**
Every principle below is subordinate to this one. Both the customer funnel and the operator
portal are ours to build — but if applying a principle would add machinery this business
doesn't have the scale for yet, don't. A $20/month tool beats a folder of our code whenever
the thing isn't part of the product experience. ([CLAUDE.md §1](CLAUDE.md#1-project-northstar).)

**2 · One home per fact.** Every fact has exactly one owner; every other surface derives or
reads it. No second copy, no resolution chain. This is the anti-drift law — and the reason
Step 0 of the realignment existed, because two runbooks were describing two different
databases.

---

## How we organize

### 3 · Domain over layer

Folders name **concepts, not tech roles**. The tree should scream *baseball coaching
platform*, not *Next.js*. A newcomer scanning `src/domains/` should learn what the business
does.

### 4 · A slice holds its noun *and* its verbs

The noun/verb distinction is real, but it's the **segment** boundary *inside* a slice, not a
top-level `entities/`-vs-`features/` split.

- The **noun** — a thing that *exists* (a `Submission`): its shape and how to read one.
  Stable, shared. Lives in the slice's `model/` + `api/`.
- The **verb** — something a user *does* (paying, uploading, checking status): interaction
  and orchestration. Lives in the same slice's `model/` + `ui/`.

**The test:** delete every verb — what's left is the noun. A slice may be all noun, all
verb, or both. `submission` is both: the record *exists*, and looking yours up is a deed.

### 5 · Code lives at the highest node where it's still true

The Postgres connection and the storage-driver seam are true for any domain → `shared/`.
The knowledge that a submission's focus is one of five values is true only for submissions →
`domains/submission/`. Push a fact up until it stops being universally true, then stop.

### 6 · Segments scale with the slice — never pre-create empty ceremony

A slice uses as few segments as it needs. Start minimal; split when a folder crowds. An
empty `lib/` is worse than no `lib/`.

### 7 · The barrel makes granularity free

Consumers import a slice's `index.ts`, never its internals. That makes the internal layout a
**private implementation detail** — changeable anytime, zero ripple. It's what lets rule 6
be safe.

### 8 · Compartmentalize the differences; unify the commonality

Separate concepts that are genuinely different even when they share a shape. But write the
*shared* part **once**, so symmetry is built in rather than hoped for. The three
transactional emails are three different messages (their domains own them) wearing one
brand shell (`shared/email` owns that).

This is the counterweight to rule 2: unify what's the *same*, separate what's *different*.
The goal is a bijection — one fact, one home.

---

## How we work

### 9 · Always green

Every step compiles and runs. Nothing is left half-broken; each step is reversible. A
refactor that requires a "don't worry, it'll typecheck at the end" is too big — cut it up.

### 10 · Honest degradation

A not-yet-built path is honestly stubbed, never mocked to look real. **Absent reads as
absent.** If email isn't configured, we log that we skipped it — we don't pretend to send.

### 11 · Docs are part of done

Each domain slice ships a `_XxxDocumentation.md`, kept true **in the same commit** as the
code it describes. Three sections, each answering one question:

- **The northstar** — what this slice *is*. The invariants, the shape, the *why*. Timeless:
  it reads the same whether the slice is one commit old or a hundred.
- **Where we are** — what's built *right now*, honestly (per rule 10): shipped ✅,
  stubbed/deferred 🔶, the open gaps. A snapshot; it churns.
- **Where we came from** — the breadcrumb trail, **and it must actually leave crumbs.** Not
  "ported from the old build" — the *record*: decisions taken **with their reasoning**, what
  each superseded, the scars. When a decision reverses an earlier one, **the earlier one
  stays**, marked superseded. We keep the trail; we never rewrite history. Date the entries.

Why the third section is worth the effort: a future reader can check themselves against
*why*, not just *what*. That's what makes a decision reviewable instead of merely visible.

**Write the real names.** A doc names the actual functions, fields, statuses, routes and env
vars — `startSubmissionAction`, `emailVerifiedAt`, `awaiting_approval`, `/api/cron/sweep` —
never "the submit handler" or "the verified flag". Paraphrase reads more smoothly and is
worth less. Three things follow from using the real ones:

- a reader goes from the sentence to the source with no translation step;
- the doc becomes a **check on naming**. If a term here doesn't match what's on screen or in
  the code, one of the three is stale — and that mismatch is now *discoverable by reading*
  rather than latent until something breaks;
- it exposes bad names. A term that needs a gloss every time it appears is a term that's
  wrong in the code. **Nomenclature should carry meaning, not require it** — if the doc keeps
  having to explain a name, rename the thing.

That's rule 2 applied to words: the name *is* the fact, and every doc that mentions it is a
surface deriving from that one home.

### 12 · Tense marks the world

**Present tense = the northstar** (the model as it *is* in the destination we're building).
**Past tense = what we left.** *"The codec owns every column name"; "column names used to be
scattered across six files."* Present tense is never about legacy, so every sentence is
unambiguous about which world it describes — and the northstar is the default reality.

**The present tense is not softened to fit the code.** Where the build lags the destination,
the sentence still states the destination and an **appended note** records the distance:
*(today: …)* when the thing exists but differs, *(not built)* when nothing implements it,
⚠️ when the northstar itself is undecided. Never the reverse — a doc that describes what the
code happens to do can only ever justify the code, and a divergence written as a hedge stops
being a to-do.

### 13 · Discuss before build

Name it → autopsy the current shape → argue the northstar → canonize the decision → build
it. Only the last beat writes code. Nothing skips the argument.

---

## What this codebase deliberately does NOT adopt from WRLD

WRLD is a large real-time platform; this is a five-domain service. Ported with eyes open:

| WRLD has | Here | Why |
|---|---|---|
| `pages/` layer | **No** — `src/app/*/page.tsx` composes directly | Next.js reserves `src/pages/` for the Pages Router; a folder there would be claimed as routes. And with one screen per route there's nothing for the layer to earn. |
| `widgets/` layer | **No** — header/footer are domain-less, so `shared/layout/` | Rule 5. Nothing here is a cross-domain block that *knows* domains. |
| Group folders + cutters | **Not yet** | No family of alikes exists. Add when a second one does. |
| `slices/` nesting | **Not yet** | No domain is big enough to recurse. |
| Lint-enforced boundaries | **Not yet** — convention + review | Five domains is small enough to police by eye. Revisit if it slips. |

Adopting empty structure would violate rule 6. These are the upgrade path, not a to-do list.

---

## Related

- [`docs/design/structure.md`](docs/design/structure.md) — the layout, segments, and naming
- [CLAUDE.md](CLAUDE.md) — what we're building, for whom, and what's out of scope
- [`docs/decisions/`](docs/decisions/) — ADRs for decisions that departed from the spec
- [OPERATIONS.md](OPERATIONS.md) — everything outside the codebase
