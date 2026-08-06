# ADR 015 — Every table lives in the domain that owns it

**Date:** 2026-08-05
**Status:** accepted and built
**Amends:** [PRINCIPLES §7b](../../PRINCIPLES.md), [structure.md §4/§5](../design/structure.md),
[_NomenclatureLaw §1/§2/§5](../../_NomenclatureLaw.md), CLAUDE.md §5/§8/§12 — all of which
said storage lived in one shared file.

## Context

`shared/db/schema.ts` held six tables and seven enums in ~400 lines, and its own docblock
stated the principle: *"the single home for every stored column. No other file spells a column
name."* The one-home half of that is right and isn't in question. The *shared file* half was
never argued for — it was inherited.

Working on submissions meant opening the submission folder **and** a 400-line shared file to
find the four columns that mattered. That is the cognitive load domain-first FSD exists to
remove, and we were paying it on the one layer we'd exempted.

The strongest argument for keeping one file was "open it and see the whole database." That
argument doesn't survive contact with the tooling: Drizzle Studio, the pgAdmin ERD, and
generated migration SQL all answer it, and none of them read our folder structure. They read
the database. So the single file was paying a locality cost for a view available three other
ways.

Worth stating plainly: **single-file schemas are the strong convention in the Drizzle
ecosystem**, and this diverges from what most Drizzle docs and examples assume. The
counter-evidence is that every ORM ecosystem whose tooling *permitted* the split took it —
Django's per-app `models.py`, Rails' one-class-per-file `app/models`, EF Core's
`IEntityTypeConfiguration<T>`. The convention correlates with a build-tool constraint, not with
a design conclusion.

## Decision

**A table or enum lives in the folder of the domain that owns it.** Placement follows
ownership, not usage: `submissionStatus` is submission's though four layers read it; `focus` is
submission's because `FOCUS_OPTIONS` and `type Focus` already were, though `coaches.specialties`
uses it too.

**One declaration per file, named for its export**, with its kind as a suffix —
`submissionsTable.ts` exports `submissions`, `fileKindEnum.ts` exports `fileKind`. Five files
named `schema.ts` are indistinguishable in Cmd+P, in the tab bar, and in a diff. The plural in
`submissionsTable.ts` is deliberate and is an amendment to the one-stem law: inside `model/`,
**plural marks the storage plane, singular marks the domain plane**.

**Declaration files form their own plane.** They import other declaration files directly and
across domains — `coachesTable` imports `usersTable`, not `@/domains/operator` — and they may
**never** import a barrel. A foreign key is a compile-time reference no barrel can carry
without closing a cycle through itself; close it and one module initialises half-formed, so a
table arrives `undefined` from inside Drizzle with a stack trace naming neither file.

**The manifest sits at `src/db/schema.ts`, outside the layer cake.** It declares nothing. It
was going to live in `shared/db/`, and the invariant *"`shared/` never imports a domain"* caught
it — a file importing every domain cannot be domain-less. Friction was information, as
PRINCIPLES claims.

⚠️ **That it can't live in `shared/` is settled; `src/db/` specifically is not.** It's a fourth
top-level folder that isn't a layer, which one file isn't enough evidence to judge. The
reasoning, and the three things that would move it, are in
[PRINCIPLES §7b](../../PRINCIPLES.md) — one home, so the two can't drift.

That move forced a second, better one: `shared/db/client.ts` no longer passes `schema` to
`drizzle()`. That argument exists solely to power the relational query API (`db.query.x`), which
this codebase has never used — every read is an explicit `select`. Dropping it leaves the shared
floor genuinely domain-free rather than exempted.

**Explicit non-goal:** never build a utility that prints or assembles the whole schema for
reading. If that starts to feel necessary, the split cost more than expected and we revisit it
rather than paper over it.

## Consequences

- **No schema change, and that was verified, not assumed.** `drizzle-kit generate` reported the
  identical fingerprint before and after — 6 tables, 28 columns on `submissions`, 6 FKs, 6
  indexes — and "nothing to migrate". `tsc`, `eslint`, `next build`, and all 149 `npm run
  simulate` checks are green.
- **Placement becomes a recurring judgment call** that a single file never had, and it drifts:
  what one domain clearly owns becomes contested when a second consumer appears. The correction
  is a file move and `tsc` finds every call site — cheap, but no longer free.
- **The cross-cutting rationale loses its natural home.** Docblocks moved with their
  declarations, but the sentences that describe a *tension between two declarations* —
  "`collectedAt` duplicates the trail deliberately", "kinds are nouns, statuses are participles"
  — now sit in one of the two folders while describing both. Studio and the ERD show neither.
  That narrative belongs in CLAUDE.md §8 and the slice docs, and it is the thing to watch: the
  real risk of this split isn't a lost column, it's a lost *reason*.
- **Everything above the declaration plane keeps the normal rules.** An `xApi.ts` imports `db`
  from `@/shared/db` and its own table from `../model/xTable` — which is the locality this was
  for. A foreign table is reached at the declaration plane too, uniformly.
- **`shared/db` shrank to one export.** Scripts, which are cross-cutting by definition, import
  tables from `@/db/schema`.
- **The duplication it exposed is now closed** (separate commit, so the "no schema change"
  verification above stayed meaningful). Putting `submissionStatusEnum.ts` beside
  `submission.ts` made two hand-kept copies of the same sixteen rungs impossible to miss — and
  the same duplication turned out to exist for `focus`, `fileKind`, `fileSet`,
  `submissionEventKind`, `emailOutcome`, and `userRole`. All seven now derive.

  **The domain vocabulary is the source; the pgEnum derives from it** — never the reverse. A
  vocabulary is what the domain *says*; storage is one of the things that says it, and a model
  that reads its own words back out of the schema has the dependency upside down
  (`model/submission.ts` opens by claiming it knows nothing about storage). The direction also
  keeps the docblocks where the reasoning is, leaving each `*Enum.ts` a pointer plus one line.

  This is the split earning its keep. The duplication predated it and was invisible across 400
  lines; adjacency is what made it obvious. Locality doesn't just reduce reading — it puts
  facts near enough to compare.
- **No `relations.ts`.** Drizzle's `relations()` is only used by the nested query API, which we
  don't use. `.references()` stays inline. If a genuine two-way reference or a join table owned
  by neither domain appears, that file goes in `src/db/` and imports both domains — never the
  reverse.
