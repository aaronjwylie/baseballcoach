# ADR 017 — Singular table names, and the `Table` suffix that makes them work

**Date:** 2026-08-05
**Status:** accepted and built
**Amends:** `_NomenclatureLaw.md` §1 (tables are singular) and §2 (retires the
plural-marks-storage carve-out written the same morning).

## Context

The schema was plural — `submissions`, `coaches`, `settings` — because that is the JavaScript
ORM default, not because anyone chose it. Ben wanted singular: a table named for what **one
row** is.

Nothing technical objects. Postgres, Drizzle, and pgAdmin are all indifferent;
`SELECT * FROM submission` is ordinary SQL. The objection is in JavaScript, and it is real:
**`submission` is used 217 times as a local variable**, `coach` 53 times. It is the obvious
name for a row you just fetched. Name the table object the same thing and the two compete for
one identifier in every file that touches both.

The codebase had already hit this and worked around it by hand, with plural names:

```ts
// scripts/simulate.ts, before
import { submissions as submissionsTable } from "@/db/schema";
```

An alias invented at the call site is a name that wanted to exist.

## Decision

**The SQL name is singular. The JavaScript export carries a `Table` suffix.**

```
model/submissionTable.ts  →  export const submissionTable = pgTable("submission", …)
```

| in code | in Postgres |
| --- | --- |
| `submissionTable` | `submission` |
| `submissionFileTable` | `submission_file` |
| `submissionEventTable` | `submission_event` |
| `coachTable` | `coach` |
| `operatorTable` | `operator` |
| `settingTable` | `setting` |

Three things fall out, and they are the reason this is better than either alternative:

- **The filename equals the export, exactly.** `submissionTable.ts` holds `submissionTable`.
  ADR 015's "filename plus a kind suffix" rule was papering over a mismatch; there is no
  mismatch now, so the rule reduces to *a file is named for what's in it.*
- **Every alias is deleted.** No `as submissionTable` anywhere, in scripts or domains.
- **`const submission = …` stays free** — the word for one row belongs to one row.

**camelCase in code, snake_case in Postgres**, as before. A table called `submissionFile` would
fold to `submissionfile` unless quoted in every query forever, and the columns are already
snake_case via `casing: "snake_case"`.

## Consequences

- **Migration `0002` is hand-written**, same reason as `0001`: `drizzle-kit` cannot tell a
  rename from a drop-plus-create without a TTY. It renames six tables, six primary keys, two
  unique constraints, five foreign keys and five indexes — **Postgres cascades a table rename
  to none of them.** Left alone the plurals survive in exactly the places nobody opens.
- **The hand-edited snapshot was verified, not trusted.** `drizzle-kit generate` afterwards
  reported *"No schema changes, nothing to migrate"* with the same fingerprint — 5/9/28/8/11/9
  columns — which is only possible if the snapshot matches the TypeScript. Use this check on
  every hand-corrected migration.
- **Two collisions surfaced during the rename, both instructive.** A local
  `const coaches = … from(coaches)` in `seed-ladder.ts` had been shadowing its own import.
  And Drizzle keys join results by the **SQL** table name, so `r.coaches` became `r.coach`
  rather than `r.coachTable` — the JS name and the result key are different things.
- **`setting` is the uncomfortable one.** One row of that table is not "a setting", it is
  *the settings* — a bag of knobs. Under the convention's own logic ("named for what one row
  is") the honest answer might be `settings`. It was made singular for consistency; if that
  ever reads as wrong, it is the first place to revisit.
- Nominal only: no data moved, no column changed shape, every id survived, so foreign keys
  stayed valid throughout. Verified locally — six singular tables, five renamed indexes, no
  plural surviving anywhere in `pg_constraint` or `pg_indexes`, and 149/149 `npm run simulate`.
