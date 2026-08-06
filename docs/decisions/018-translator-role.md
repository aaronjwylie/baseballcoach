# ADR 018 — The translator role: `operator` + `operatorProfile`, and assignment becomes a join

**Date:** 2026-08-05
**Status:** phases 1 and 2 **built and deployed** (2026-08-06). Phase 3 — the assignment join —
is designed but not built, and waits on Q2. **Q1 is resolved**; Q2 and Q3 remain open.
**Would amend:** `_NomenclatureLaw.md` §3 (operator covers three roles), CLAUDE.md §8 (retires the
`coach` table into `operatorProfile`, adds `submission_assignment`), and drops
`submission.assignedCoachId`.

## Context

Translation is already in the product. Four rungs of the ladder are translation rungs, two of the
four file kinds are translations, and `needsTranslation()` derives the need from the customer's
languages against the coach's. What's missing is the **person**: today the admin uploads the
translated files themselves, so `intake_translating` means "the admin is doing it."

[`docs/design/northstar/`](../design/northstar/) already specifies the alternative in full.
`Translator` is a first-class party there with the same four verbs a coach has:

| | coach | translator |
| --- | --- | --- |
| assigned | step 4 | steps **5 and 11** |
| told | ⑤ hand-off | ③ hand-off → translator |
| downloads | step 9 | step 7 |
| uploads | step 10, feedback | step 8, translations paired to originals |
| tells Admin | ⑥ | ④ translated → Admin |

So this is not a new mechanism. It is the mechanism that already exists, given a second occupant.

## Decision

### 1 · Two tables: `operator` for logging in, `operatorProfile` for doing the work

**An operator is someone who logs in.** That is the whole definition, and it is what the word has
meant in `_NomenclatureLaw.md` §3 since the portal was built.

```
operator          id · email · passwordHash · role · name · isActive
operatorProfile   operatorId · languages · bio · imageUrl · specialties
```

An **admin** has an `operator` row and no profile. A **coach** and a **translator** each have both,
and are distinguished by `role` alone — they carry identical fields, since translators get bios and
photos too.

The split is by *who a fact is true of*, which sorts into three tiers:

| tier | fields | admin |
| --- | --- | --- |
| everyone who logs in | `email` · `passwordHash` · `role` · `name` · `isActive` | ✅ |
| people who take assigned work | `languages` | ❌ |
| people shown on the website | `bio` · `imageUrl` · `specialties` | ❌ |

**The presence of a profile row carries meaning**: this person does assigned work and can appear
publicly. That is the load-bearing part. With everything on one table an empty `languages` cannot
distinguish *"this is an admin"* from *"nobody has filled in this coach's languages yet"* — and the
second case is a live problem, named in [CLAUDE.md §10](../../CLAUDE.md) as the thing currently
stopping the translation rule from doing anything. Two tables make that distinction structural
rather than a convention someone has to remember.

The `coach` table is retired into `operatorProfile`.

#### Alternatives considered

**One table, nullable extras.** The first draft of this ADR. Rejected: an admin would carry four
permanently empty columns, and the ambiguity above is unresolvable. One null column would be a
shrug; four is a shape that is wrong.

**A table per person — `admin`, `coach`, `translator`.** The instinct is to model four people as
four tables, and it was seriously considered. Rejected on four counts:

- **`admin` would hold nothing.** Every fact about an admin is a login fact. The table would be a
  lone `operatorId` — a boolean wearing a table.
- **`coach` and `translator` would be column-identical**, so it isn't separation, it is duplication
  with a delay. Add `timezone` to one and the bug is forgetting the other.
- **The assignment join needs a single foreign key.** Two tables force either `coachId` *or*
  `translatorId` — two nullable columns, the exact smell Q1 is already uneasy about — or a
  polymorphic reference, which Postgres cannot enforce with a foreign key at all. "Who covers
  Japanese?" also becomes a permanent `UNION`.
- **`role` would have two homes** — the column, and which table you are in. That is law #2.

What genuinely separates a coach from a translator is *what they are asked to do*, and `role`
already carries that. If the fields ever diverge — translators gaining language *pairs*, say — split
then. Splitting later is cheap; un-duplicating two tables that have drifted is not.

**Renaming `operator` to `auth` or `login`.** The folder is visibly auth-heavy — four of six `api/`
files and all four `ui/` files are sessions and passwords. But that is a side effect of everything
else being correctly placed: an operator's other verbs live in the domains they act on (assigning is
`coach`, approving is `feedback`, purging is `submission`). What remains is the small set of things
they do to *themselves*. Rejected because `shared/auth` already exists — a `domains/auth` beside it
would provoke "which one?" every time — and because the operator record would then live in a folder
named for a verb. [PRINCIPLES §4](../../PRINCIPLES.md): a slice holds its noun *and* its verbs.

### 2 · No new word for "coach or translator"

The word already exists. `_NomenclatureLaw.md` §3: *"**operator** — anyone who logs in — `admin`
or `coach`. The word that covers both."* Adding a third role edits that sentence and nothing else.

`vendor` was considered and rejected: procurement language in a coaching product, requiring a
gloss the moment it appears, and implying a commercial relationship the code deliberately doesn't
model (no payouts, no invoices, [CLAUDE.md §2](../../CLAUDE.md) rules out Stripe Connect).

**The subset who take work needs no noun either**, because the assignment record names the
relationship. Where a predicate is needed it is an exhaustive Record, the same shape the status
predicates use:

```ts
const CAN_BE_ASSIGNED: Record<Role, boolean> = {
  admin: false, coach: true, translator: true,
};
```

A fourth role becomes a compile error rather than a silent omission — the failure that let
`awaiting_approval` slip through a list.

### 3 · `submission_assignment` replaces `assignedCoachId`

The northstar flags this twice, in `assigning()` and again in its open questions:

> `assignedCoachId` is a single column and cannot hold two. The northstar wants a join, the way
> file kinds already do.

Two reasons a column can't survive. A submission can carry **two translators** — *"the return leg
can take a different translator"* — and the trail is built around `assigned — {id}` /
`unassigned — {id}`, one row each, with the count derived rather than stored.

**An assignment is a promise to produce a file**, and that framing is what makes the table
simple. It carries no role and no nullable discriminator, because the thing being promised
already has a vocabulary — the four folders:

```
submission_assignment
  id            uuid, pk
  submissionId  → submission, cascade, indexed
  operatorId    → operator
  produces      file_kind          -- what they owe us
  assignedAt    timestamptz

  coach                →  produces "feedback"
  intake translator    →  produces "intake_translation"
  feedback translator  →  produces "feedback_translation"
```

**No `role` column.** The operator already carries their role; storing it again would be a second
home for a fact (law #2). Which role a row implies is derivable, and never needs to be.

**No nulls.** Every assignment produces exactly one kind of thing. The first draft had a `role`
plus a nullable `leg` meaningful only for translators — the same smell as an admin carrying four
empty profile columns, and rejected for the same reason (see Q1, now resolved).

The fourth kind, `intake`, is the one nobody is assigned to produce: the customer supplies it.
That asymmetry is real, and the shape shows it rather than hiding it behind a null.

It also answers a question `leg` could not. **"What is still outstanding on this submission?"**
becomes *assignments with no matching file yet* — an actual query, rather than inferring work from
a status. Two translators on one submission stop being a special case and become two rows.

**A row is deleted to unassign — no `unassignedAt`.** The trail already holds the history, so this
table answers only *who has it now*. That is the same relationship `submission.status` has to
`submission_event`, and it means "who is on this?" never needs `where unassignedAt is null`.

Coaches move onto the join too. One way to answer the question, not two.

### 4 · `translator` is added to the enum in its own migration

Postgres allows `ALTER TYPE … ADD VALUE` inside a transaction on PG12+, but **the new value cannot
be used until that transaction commits** — and Drizzle wraps each migration in one. So adding
`translator` and writing any row that uses it must be two migrations. Cheap to obey, confusing to
diagnose.

### 5 · `domains/coach` dissolves; `domains/operator` keeps its name

| what's in it | where it goes |
| --- | --- |
| the coach record + CRUD | `operator` |
| assignment (`assignCoachAction`, `AssignCoachSelect`) | `submission` — assignment is a fact about a submission |
| the public coach list | `landing`, reading operators by role |

Net **one fewer domain**. No `admin`, `translator` or `customer` domain is created: those are roles
and people, not nouns the code stores. The customer has no record at all — their behaviour is
already four domains (`checkout`, `verification`, `upload`, `payment`) named for the doing.

## Open questions — these are the ones to mark up

**Q1 · ~~`leg` is nullable and means something for only one role.~~ — RESOLVED 2026-08-06.**

The column is gone. Asking *what an assignment actually is* dissolved the question: it is a
**promise to produce a file**, so the row names the file kind and nothing else. A coach produces
`feedback`, a translator produces `intake_translation` or `feedback_translation`. No null, no
discriminator, and no role column duplicating what the operator already says.

Worth recording how it was found, because the method generalises: the first draft asked *"what
extra fact does an assignment need?"* and got a nullable one. Asking instead *"what is this row
for?"* produced a shape where nothing is optional. **A stubborn nullable column is usually a sign
the row is modelling the wrong noun.**

The same reframing had already happened twice in this ADR — `coach` dissolving into `operator`,
and the admin not fitting one identity table. All three came from counting what is actually
there and asking who each fact is true of.

**Q2 · `response` → `feedback` — now a precondition, not a nicety.** Resolving Q1 raised its
status: the assignment table stores a `file_kind`, and the kind a coach produces is spelled
`response` in the enum but `feedback` everywhere the northstar and the emails speak. Building the
join on the old spelling would bake the inconsistency into a new table's data, not just its
column names. **Do this first, or accept renaming enum values that rows already point at.**

Still a real decision — it widens the blast radius of an otherwise additive change — but the
cheap option (defer it again) is no longer free.

**Q3 · Do steps 5 and 11 need their own rungs?** They share `intake_translating` /
`response_translating` with the work that follows, so the queue cannot tell *"sent to a
translator"* from *"the translator has it"* — precisely the distinction `sent_to_coach` vs
`in_review` exists to make on the coach side. It matters more once a real person is waiting. The
northstar left it open rather than add two rungs to a sixteen-rung ladder.

## Consequences if accepted

- **A migration that moves data, not just names.** Unlike `0001` and `0002`, this one copies
  `coach` columns onto `operator` and rewrites `assignedCoachId` into join rows before dropping
  anything. It needs a verification step of its own — row counts before and after — not just a
  clean `drizzle-kit generate`.
- **`npm run simulate` must grow a translator path** before this is called done. It is the only
  check that walks the ladder through real domain functions, and the translation rungs are exactly
  where it has already caught two bugs that made that path impossible to complete.
- **`STAGE_CHAIN` and the northstar converge or diverge here.** The northstar's stated end state is
  that it becomes the model once the pipeline matches. This is the change that gets closest.
