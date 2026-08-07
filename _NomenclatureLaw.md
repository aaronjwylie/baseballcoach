# Nomenclature — how Baseball Sensei names things

The one home for naming. Pairs with [PRINCIPLES.md](PRINCIPLES.md) (the *why*) and
[`docs/design/structure.md`](docs/design/structure.md) (the *where*); this is **how it's
spelled**. If a name here disagrees with a file, the file is wrong.

Adopted from `wrld-sandbox/_NomenclatureLaw.md` so the two codebases read alike, then
rebuilt around this product's own nouns. Supersedes `structure.md` §6, which now points here.

> **Tense** ([PRINCIPLES §12](PRINCIPLES.md)): present tense = the **northstar**; past tense =
> what we left. This doc is present tense throughout. Where the code hasn't caught up, the
> divergence is marked *(today: …)* — never by softening the rule.

**The law behind the law:** *nomenclature should carry meaning, not require it.* A term that
needs a gloss every time it appears is a term that's wrong in the code.

---

## 1 · Casing at a glance

| Kind | Convention | Example |
|---|---|---|
| Type / interface | `PascalCase`, singular | `Submission` · `SubmissionPatch` · `PublicSubmission` |
| Union member (a domain value) | the DB enum's own spelling | `'awaiting_payment'` · `'Hitting'` |
| Component (file **and** export) | `PascalCase` | `PlayerInfoForm.tsx` → `PlayerInfoForm` |
| Module file | `camelCase` | `submissionApi.ts` · `flowSession.ts` |
| API client (file **and** export) | `camelCase` `xApi` | `submissionApi.ts` → `submissionApi` |
| Server Action file | `camelCase` `xActions` | `checkoutActions.ts` |
| Email sender file | `camelCase` `xEmail` | `feedbackEmail.ts` |
| Domain slice folder | `camelCase` | `submission` · `checkout` · `verification` |
| Segment folder | fixed lowercase set | `model` · `api` · `ui` · `lib` · `config` |
| Barrel | `index.ts` | |
| Slice doc | `_<Slice>Documentation.md` | `_SubmissionDocumentation.md` |
| Table declaration file | `camelCase` `xTable`, **matching its export exactly** | `submissionTable.ts` → `submissionTable` |
| Enum declaration file | `camelCase`, its export **plus `Enum`** | `submissionStatusEnum.ts` → `submissionStatus` |
| DB table | `snake_case`, **singular** — named for what *one row* is | `submission` · `submission_file` · `submission_event` |
| DB column | `snake_case` | `customer_email` · `emailed_at` |
| Drizzle field | `camelCase` — the mapper owns the crossing | `customerEmail` |
| id field | `xId`, `camelCase` | `submissionId` · `stripePaymentId` · `assignedCoachId` |
| boolean field | `isX` / `hasX` | `isActive` · `hasFeedback` |
| timestamp field | `xAt` — ISO string in the domain, `Date` in the row | `submittedAt` · `completedAt` |

**No hyphens in folders**, so a folder name reads as one concept.

**One exception, forced from outside:** `src/app/` follows **Next.js**, which reserves
`page.tsx`, `layout.tsx`, `route.ts`, `proxy.ts`, and lowercase URL segments. Framework
conventions win inside the framework's own directory, and nowhere else.

---

## 2 · One stem per concept

A domain folder and everything in it use **one** word, never two forms of the same idea:

```
submission · submissionApi · SubmissionPatch · submission_file · _SubmissionDocumentation
```

A mix of `submission` and `submissions` in code is the exact smell this kills — and since
2026-08-05 there is no plural anywhere to mix with. Tables are singular, named for what **one
row** is: `submission`, `coach`, `operator` ([ADR 017](docs/decisions/017-singular-table-names.md)).

**The JavaScript export carries the `Table` suffix; the SQL name does not.**

```
submissionTable.ts   →   export const submissionTable = pgTable("submission", …)
```

Not decoration. `submission` is the obvious name for *one row you just fetched*, and it is used
217 times as a local. Name the table object the same thing and the two fight in every file that
touches both — which is why the scripts had grown `import { submissions as submissionsTable }`
by hand. The suffix makes the alias unnecessary, so the filename, the export, and what you type
are one word.

An earlier version of this section said plural marked the storage plane and singular the domain
plane. That was a way of living with a mismatch, not a rule; the mismatch is gone.

### The grammar rule that keeps stems shared without collisions

When one stem must appear on two different axes, **the grammar carries the difference**:

| Axis | Grammar | Answers | Example |
|---|---|---|---|
| **File kind** | a **noun** | *what is this file?* | `intake` · `intake_translation` |
| **Status** | a **participle** | *what has happened?* | `intake_translating` · `intake_translated` |

So `intake` is one concept with one stem, and `submissionFileTable.kind === 'intake_translation'`
never reads as `submission.status === 'intake_translated'`. Same word, different part of
speech, no ambiguity at the call site.

---

## 2b · How to rename

**Added 2026-08-05, the hard way.** The law says what things are called; it said nothing about
changing what they are called, and a rename shipped sixty-six wrong strings to production.

`submissions` was replaced with `submissionTable` everywhere the word appeared. The public FAQ
asked *"Who are the coachTable?"*, the admin nav pointed at `/admin/coachTable` — a 404 — and coach
feedback uploads wrote to `submissionTable/{id}/feedback` in Blob storage.

**`tsc`, `eslint`, `next build` and all 149 simulate checks passed**, and none of them could have
failed. A wrong string is a well-typed string. `simulate` renders no copy and follows no URLs.

Three rules, and a guard that enforces the one that matters:

- **Scope the substitution to files that import the thing.** Prose and copy don't import anything.
  A word-boundary match cannot tell an identifier from a sentence, and the words worth renaming are
  exactly the words that appear in sentences.
- **`xTable` names a Drizzle export and nothing else.** Not a prop, not a local, not a URL segment,
  not a word. Everywhere else the English plural stands — *coaches*, *submissions*, *operators*.
- **Read the diff.** On a word this common, green checks mean nothing. They tell you the code still
  compiles, which was never in doubt.

**`npm run check:names` enforces the second rule**, and runs as the first step of `npm run build`,
so it fails a deploy rather than teaching the lesson twice. It flags a table name inside any string
or template literal, in prose in a comment, or in a file that never imported it — while allowing a
`backticked reference` in a docblock, which is documentation working as intended.

That guard exists because rules people have to remember don't survive, and because the checks that
already existed **structurally could not** catch this class of mistake.

---

## 3 · The settled words

The vocabulary is **intake / feedback** — what the customer sent, what the coach wrote. It runs
through file kinds, statuses, folders, and conversation alike.

It was **intake / response** until 2026-08-05. `response` was chosen for symmetry with `intake`
and lost to the fact that nobody says it: the customer is promised *feedback*, the button says
*Send feedback*, the email is *your feedback is ready*, and the domain folder was `feedback` from
the start. One word appearing in the schema and a different one in every sentence around it is the
same violation as two folders for one concept — §2, one level up. Migration `0005` renamed the four
enum values; see also **§2b**, since a rename this broad is exactly what `check:names` exists to
police.

| Word | Means |
|---|---|
| **customer** | the parent who pays. **Never has an account** |
| **player** | the child in the footage. A field on a submission, never an entity |
| **coach** | the reviewer in Japan. Has an operator login |
| **translator** | carries a submission between languages. An operator login too — a role, not a table |
| **operator** | anyone who logs in — `admin` (the admin), `coach`, or `translator`. The word that covers all three |
| **submission** | one paid request carrying a **pack** of files, reviewed together — not one video |
| **intake** | the files the **customer** sent |
| **feedback** | the files the **coach** wrote back |
| **pack** | the set of files moving together. Preferred over "the files" when the togetherness matters |
| **focus** | what the review is about — `Hitting` · `Pitching` · `Fielding` · `Catching` · `Other` |
| **the flow** | the customer's four steps on `/start`. Not "the funnel", not "checkout" |
| **the flow window** | the 30-minute sliding session governing an unfinished attempt. **The only clock in the flow** |
| **scratch pad** | an unfinished, unpaid submission — discardable at any moment |
| **scrub** | delete an unfinished submission, row and bytes together. Never used for a paid one |
| **the boundary** | step 4, payment. Before it a scratch pad, after it a record |
| **the ladder** | the sixteen statuses, in order. *A path with branches, not a progress bar* |
| **rung** | one status on the ladder |
| **stamp** *(verb)* | record that something happened, once, with a time |
| **the point of no return** | the first operation in a stage whose effect exists outside our database |
| **repair forward** | catch the record up to a world that already moved. The opposite of rolling back |
| **ratchet** | a counter that never gives back — the verification attempts |
| **sweep** | the scheduled deletion pass |
| **purge** | delete a submission's files. Records survive; **the submission is kept forever** |
| **capability** | a signed, purpose-bound token that grants access without a login |
| **the queue** | the admin's list of submissions. What statuses exist to filter |

### Retired words — do not use for northstar concepts

| ~~Retired~~ | Use | Why |
|---|---|---|
| ~~video~~ (as the unit) | **submission** / **pack** | a submission carries clips, stills and documents. "Video" named it wrongly from the start |
| ~~feedback file~~ (singular) | **feedback** (the pack) | it's a pack now, like the intake — the retirement was the *singular*, not the word |
| ~~response~~ | **feedback** | chosen for symmetry with `intake`, retired because nobody says it — see §3. Renamed 2026-08-05, migration `0005` |
| ~~resume~~ | — | there is no resume. Every page load starts at step 1 |
| ~~awaiting_upload~~ | — | retired with the flow that needed it; files arrive before payment |
| ~~funnel~~ | **the flow** | one word for the customer's path |
| ~~passthrough~~ | — | the Mux trick. A submission's own uuid is the link |
| ~~user~~ / ~~account~~ (the entity) | **operator** | settled above since the portal existed, but the code said `account` (folder), `user` (files, table) and `Operator` (types) — three words, and the settled one used only by the types. Worse than untidy: **customers use this product constantly and never get a row**, so a table called `users` named the wrong population. Renamed 2026-08-05, migration `0001` ([ADR 016](docs/decisions/016-operator-not-account.md)). The last one hiding in a function name — `setUserPassword` — went on 2026-08-06 |

---

## 4 · The type family

One `model/<x>.ts` file holds the whole family. Only the shapes the entity actually needs.

| Type | Meaning | Example |
|---|---|---|
| `X` | the full entity — the **operator's** view | `Submission` (⚠️ `Coach` is a *role*, see below) |
| `PublicX` | the shareable subset, `Pick<X, …>`, co-located | `PublicSubmission` |
| `XInput` | what a **form** collects, before it's an entity | `SubmissionInput` |
| `XDraft` | the partially-filled input a form holds mid-edit | `SubmissionInputDraft` |
| `NewX` | what a **create** needs | `NewSubmission` |
| `XPatch` | `Partial<…>` — **the one write shape** | `SubmissionPatch` |
| `XRow` | the DB shape, only inside `api/xRow.ts` | — |
| enum / union | a `PascalCase` type of DB-spelled literals | `SubmissionStatus` · `Focus` · `FileKind` |

**`Pick<X, …>` over a hand-written subset**, always. A `PublicSubmission` that restates its
fields drifts the moment `Submission` changes; a `Pick` cannot.

### Name the shape, not the role that reached it first

`X` is what the entity **is**. If a second kind of person turns out to have the identical shape,
`X` was named after a *role* and the role got mistaken for the entity.

The tell is an import: a file about one role reaching into its sibling for the type they both
are. `translatorApi.ts` importing `Coach` (2026-08-06) was that, exactly — and reading it in a
diff is easier than noticing the type was wrong two months earlier.

`Coach` was a real entity while there was a `coach` table. ADR 018 dissolved it into
`operator` + `operator_profile`, and from that moment `Coach` described *an operator with a
profile* — which a translator also is, field for field. The name survived its own entity.

**The test:** if a second role arrived tomorrow, would the type need renaming? If yes it is
already named wrong, because the name is describing a *use* of the shape rather than the shape.
A role belongs in the enum (`Role = admin · coach · translator`), which is where a value that
varies per row is supposed to live. It does not belong in a type name, where it can only be
changed by a rename.

This does **not** mean role-named files are wrong. `coachApi.ts` is right when it holds what is
genuinely a coach's alone — the public bio, the landing-page photo. It is wrong when it holds
the machinery both roles use, and `PRINCIPLES.md` §8 has the diagnostic for telling those apart.

### Exhaustive maps over lists

A question every union member must answer is a **`Record<Union, T>`**, never a list:

```ts
const PAID_AT_STATUS: Record<SubmissionStatus, boolean> = { … }
```

Adding a status without answering is then a **compile error**. This is not style — it is the
mechanism that caught `awaiting_approval` slipping into an unpaid list, and it gets more load-
bearing as the ladder grows.

---

## 5 · The slice layout

```
domains/<slice>/
├── model/<slice>.ts              # the type family
├── model/<slice>sTable.ts        # the pgTable — one declaration, named for its export
├── model/<x>Enum.ts              # one pgEnum, likewise. Never grouped
├── model/<slice>Input.ts         # the Zod schema, when a form collects one
├── api/<slice>Api.ts             # the data client
├── api/<slice>Row.ts             # the ONLY column↔domain mapper
├── api/<slice>Actions.ts         # Server Actions
├── api/<slice>Email.ts           # the messages this slice owns
├── ui/<Component>.tsx
├── index.ts                      # the barrel — the public surface
└── _<Slice>Documentation.md
```

Segments are created **when they're needed**, never pre-made empty.

**Two invariants worth memorising:**

- **Every storage column name lives in one place** — the owning slice's `model/<x>Table.ts`,
  surfaced through `<slice>/api/<slice>Row.ts`. If you're mapping columns anywhere else, you're
  in the wrong file. *(The address moved from `shared/db` on 2026-08-05,
  [ADR 015](docs/decisions/015-schema-by-domain.md); the invariant didn't.)*
- **One declaration per file, always** — even the two-line enums. The rule buys the *absence of
  a judgment call* about what groups with what, which is worth more than the file count it
  costs: the moment a `submissionEnums.ts` exists, the next enum joins it by default and the
  shared file is back, just smaller.
- **Every `process.env` read lives in one file** — `shared/config/env.ts` for secrets,
  `publicEnv.ts` for the browser. Split by **audience**, so a client component never imports a
  module full of secrets.

**Import from a slice's barrel**, never deep into its `model/` or `api/` — with one exception
that is a hard rule, not a preference: **a `"use client"` file imports the slice's `model/`
directly.** A barrel that re-exports `api/` pulls the Postgres client into the browser bundle
and the build fails.

---

## 6 · Naming the messages

Each email lives in the domain that owns its event, as `api/<x>Email.ts`, and is **numbered**
①–⑨ to match the path table in
[`_SubmissionDocumentation.md` §2](src/domains/submission/_SubmissionDocumentation.md). The
number is the shared handle: say "⑦" and everyone knows which message, which step, and who
receives it.

Two altitudes, kept distinct:

- **User words** — what the button says: *"Approve & send"*, *"Send feedback"*
- **System words** — what the code calls it: `approveAndComplete`, `storeFeedback`

They are not synonyms and neither replaces the other. A button labelled `approveAndComplete`
is as wrong as a function named `approveAndSend`.

---

## 7 · The `_XxxDocumentation.md` shape

Every slice has one. Three sections, tense-marked:

1. **The northstar** — present tense. What this slice is for, and its invariants.
2. **Where we are now — `<date>`** — ✅ built · 🔶 partial · ❌ not built.
3. **Where we came from** — past tense. What it replaced, and the dated trail.

**Read the slice's doc before changing the slice.** They're kept true in the same commit as
the code — a doc updated later is a doc that was wrong in between.

**Write the real names.** A doc names the actual functions, fields, statuses, routes and env
vars — `startSubmissionAction`, `emailVerifiedAt`, `awaiting_approval`, `/api/cron/sweep` —
never "the submit handler". Jargon is welcome; vagueness is not. This is also how the docs
audit the code: a term that can't be written plainly in a sentence is a term to rename.

---

## Related

- [PRINCIPLES.md](PRINCIPLES.md) — why the codebase is shaped this way
- [`docs/design/structure.md`](docs/design/structure.md) — the layout and dependency rules
- [`src/domains/submission/_SubmissionDocumentation.md`](src/domains/submission/_SubmissionDocumentation.md) — the path, the ladder, the point of no return
- [`docs/design/rollout.md`](docs/design/rollout.md) — the route from here to there
