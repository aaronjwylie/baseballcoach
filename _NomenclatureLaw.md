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
| Table declaration file | `camelCase` `xTable`, **matching its export** | `submissionsTable.ts` → `submissions` |
| Enum declaration file | `camelCase` `xEnum`, **matching its export** | `submissionStatusEnum.ts` → `submissionStatus` |
| DB table | `snake_case`, **plural** | `submissions` · `submission_files` · `submission_events` |
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
submission · submissionApi · SubmissionPatch · submission_files · _SubmissionDocumentation
```

A mix of `submission` and `submissions` in code is the exact smell this kills. *(Plural is
correct in two places, and only two: the DB table name, and the file that declares it — see
below.)*

**Amended 2026-08-05** ([ADR 015](docs/decisions/015-schema-by-domain.md)). The split put
`submissionsTable.ts` in the same folder as `submission.ts`, which reads as the violation this
rule exists to catch. It's allowed, for one reason: **a declaration file is named for its
export**, and the export is `submissions` because that's the table's name. Call the file
`submissionTable.ts` and grepping `submissions` no longer finds where `submissions` is
declared, which is the exact findability failure the whole convention is for.

That leaves the plural doing real work rather than drifting: **inside `model/`, plural marks
the storage plane and singular marks the domain plane.** `submission.ts` is what a submission
*is*; `submissionsTable.ts` is where it's *stored*. Same stem, different axis, same trick as
the noun/participle rule below.

**This applies across axes, not just within a folder.** The same concept named one way in the
schema and another in the status enum is the same violation, one level up — it just takes
longer to notice. Two vocabularies for one pair of concepts is how a codebase starts needing a
translator.

### The grammar rule that keeps stems shared without collisions

When one stem must appear on two different axes, **the grammar carries the difference**:

| Axis | Grammar | Answers | Example |
|---|---|---|---|
| **File kind** | a **noun** | *what is this file?* | `intake` · `intake_translation` |
| **Status** | a **participle** | *what has happened?* | `intake_translating` · `intake_translated` |

So `intake` is one concept with one stem, and `submissionFiles.kind === 'intake_translation'`
never reads as `submission.status === 'intake_translated'`. Same word, different part of
speech, no ambiguity at the call site.

---

## 3 · The settled words

The vocabulary is **intake / response** — what the customer sent, what the coach wrote. It runs
through file kinds, statuses, folders, and conversation alike.

| Word | Means |
|---|---|
| **customer** | the parent who pays. **Never has an account** |
| **player** | the child in the footage. A field on a submission, never an entity |
| **coach** | the reviewer in Japan. Has an operator login |
| **operator** | anyone who logs in — `admin` (the admin) or `coach`. The word that covers both |
| **submission** | one paid request carrying a **pack** of files, reviewed together — not one video |
| **intake** | the files the **customer** sent |
| **response** | the files the **coach** wrote back |
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
| ~~feedback file~~ (singular) | **response** | it's a pack now, like the intake |
| ~~resume~~ | — | there is no resume. Every page load starts at step 1 |
| ~~awaiting_upload~~ | — | retired with the flow that needed it; files arrive before payment |
| ~~funnel~~ | **the flow** | one word for the customer's path |
| ~~passthrough~~ | — | the Mux trick. A submission's own uuid is the link |

---

## 4 · The type family

One `model/<x>.ts` file holds the whole family. Only the shapes the entity actually needs.

| Type | Meaning | Example |
|---|---|---|
| `X` | the full entity — the **operator's** view | `Submission` · `Coach` |
| `PublicX` | the shareable subset, `Pick<X, …>`, co-located | `PublicSubmission` |
| `XInput` | what a **form** collects, before it's an entity | `SubmissionInput` |
| `XDraft` | the partially-filled input a form holds mid-edit | `SubmissionInputDraft` |
| `NewX` | what a **create** needs | `NewSubmission` |
| `XPatch` | `Partial<…>` — **the one write shape** | `SubmissionPatch` |
| `XRow` | the DB shape, only inside `api/xRow.ts` | — |
| enum / union | a `PascalCase` type of DB-spelled literals | `SubmissionStatus` · `Focus` · `FileKind` |

**`Pick<X, …>` over a hand-written subset**, always. A `PublicSubmission` that restates its
fields drifts the moment `Submission` changes; a `Pick` cannot.

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
