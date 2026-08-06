# ADR 018 — The translator role: `operator` absorbs `coach`, and assignment becomes a join

**Date:** 2026-08-05
**Status:** ⚠️ **proposed — not built.** Written to be marked up. The three open questions at the
bottom are genuinely open; the decisions above them are ready to argue with.
**Would amend:** `_NomenclatureLaw.md` §3 (operator covers three roles), CLAUDE.md §8 (drops the
`coach` table, adds `submission_assignment`), and retires `submission.assignedCoachId`.

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

### 1 · `operator` absorbs `coach`; the `coach` table goes

`coach` is a 1:1 table beside `operator` holding `name`, `specialties`, `languages`, `isActive`,
`imageUrl`, `bio`. A translator needs all of those — Ben's call is that translators get bios and
photos too, even though nothing renders them yet.

Once coach and translator have the same shape, the difference between them is **one column,
`role`**, and a separate table stops earning its keep:

```
operator   id · email · passwordHash · role · name · languages · isActive · bio · imageUrl · specialties
```

**The test a table has to pass is "does it hold facts nothing else holds".** `coach` never did —
it held facts about an operator. It looked like a domain because *coach* is a person in the
business, which is not the same thing.

Three things fall out:

- **`needsTranslation` gets a wider question.** "Who covers this language pair?" becomes one query
  over `operator`, whatever their role. Today it can only see coaches.
- **`isActive` starts gating what it sounds like it gates.** On `coach` it leaves the login
  working; on `operator` it doesn't.
- **Somebody who both coaches and translates is one human, one row, one login.**

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

```
submission_assignment
  id            uuid, pk
  submissionId  → submission, cascade, indexed
  operatorId    → operator
  role          operator_role     -- who they are on this submission
  leg           file_kind, null   -- 'intake' | 'feedback' — translators only (see Q1)
  assignedAt    timestamptz
```

**A row is deleted to unassign — no `unassignedAt`.** The trail already holds the history, so this
table answers only *who has it now*. That is the same relationship `submission.status` has to
`submission_event`, and it means "who is on this?" never needs `where unassignedAt is null`.

Coaches move onto the join too. One way to answer the question, not two.

### 4 · `translator` is added to the enum in its own migration

Postgres allows `ALTER TYPE … ADD VALUE` inside a transaction on PG12+, but **the new value cannot
be used until that transaction commits** — and Drizzle wraps each migration in one. So adding
`translator` and writing any row that uses it must be two migrations. Cheap to obey, confusing to
diagnose.

### 5 · `domains/coach` dissolves

| what's in it | where it goes |
| --- | --- |
| the coach record + CRUD | `operator` |
| assignment (`assignCoachAction`, `AssignCoachSelect`) | `submission` — assignment is a fact about a submission |
| the public coach list | `landing`, reading operators by role |

Net **one fewer domain**. No `admin`, `translator` or `customer` domain is created: those are roles
and people, not nouns the code stores. The customer has no record at all — their behaviour is
already four domains (`checkout`, `verification`, `upload`, `payment`) named for the doing.

## Open questions — these are the ones to mark up

**Q1 · `leg` is nullable and means something for only one role.** A translator is assigned to the
intake leg or the feedback leg; a coach has no leg, because they receive intake and produce
feedback in one assignment. A nullable discriminator meaningful for a subset of rows is a smell.
The alternatives seem worse — two roles (`intake_translator`, `feedback_translator`) overloads
`role` with scheduling, and a second assignment table reintroduces the duplication §1 removes — but
this is the weakest part of the design.

**Q2 · Should `response` → `feedback` ride along?** The northstar already renamed the file kinds
and says the enum was deliberately left alone because it's a migration. If we are migrating
anyway, doing it here avoids a third pass over the same enums. It also widens the blast radius of
a change that is otherwise additive.

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
