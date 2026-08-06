# ADR 016 — One word for the people who log in: `operator`

**Date:** 2026-08-05
**Status:** accepted and built
**Amends:** `_NomenclatureLaw.md` §3 (adds `user` / `account` to the retired words), and
every path that said `domains/account`.

## Context

`_NomenclatureLaw.md` §3 settled this word when the portal was built:

> **operator** — anyone who logs in — `admin` or `coach`. The word that covers both.

The code never followed. One concept carried four names:

| where | word |
| --- | --- |
| domain folder | `account` |
| model, api, table files | `user` |
| TypeScript types | `Operator`, `OperatorSession` |
| Postgres | `users`, `user_role`, `coaches.user_id` |

**The settled word was used only by the types.** This wasn't an open question anyone
needed to decide — it was a decision already made and never carried into the code, which
is the more common and less visible kind of drift.

It also named the wrong population. **Customers use this product constantly and never get
a row in `users`.** A reader who opens that table reasonably expects to find the parents
who paid; they find six operators. That fails the law's own closing test —
*nomenclature should carry meaning, not require it.*

## Decision

**`operator` everywhere**, across all four axes:

```
domains/account/           → domains/operator/
  model/user.ts            → model/operator.ts
  model/usersTable.ts      → model/operatorsTable.ts   (exports `operators`)
  model/userRoleEnum.ts    → model/operatorRoleEnum.ts (exports `operatorRole`)
  api/userApi.ts           → api/operatorApi.ts
```

and in Postgres, via migration `0001_rename_users_to_operators`: table `users` →
`operators`, type `user_role` → `operator_role`, column `coaches.user_id` →
`operator_id`, plus all four constraint names, since Postgres does not cascade a table
rename to its constraints.

**`src/app/account/` keeps its name.** That is a URL an operator bookmarks, and "account"
is the right word for a human reading a settings page. The stem law governs code;
`src/app/` already follows Next.js conventions rather than ours, and a route is product
surface, not nomenclature.

**`auth.ts`, `dal.ts`, `passwordReset*` keep theirs too.** Those name *activities* within
the slice, not second words for its noun. One stem per concept doesn't mean one word per
folder.

## Consequences

- **The migration is hand-written.** `drizzle-kit generate` cannot distinguish a rename
  from a drop-plus-create without a TTY to ask, and its non-interactive answer here would
  have been `DROP TABLE "users"` — every operator login, deleted. `--custom` produced an
  empty migration, and the snapshot it copied still described the old names, so both
  halves were written by hand.
- **The hand-edited snapshot was verified, not trusted.** After the edit,
  `drizzle-kit generate` reported *"No schema changes, nothing to migrate"* — which is
  only possible if the snapshot matches what the TypeScript declares. That check is
  available for any hand-corrected migration and should be used every time.
- **Live operator sessions are invalidated.** The session claim `userId` became
  `operatorId`, so existing cookies no longer resolve and everyone logs in again. With six
  operators behind a Basic Auth gate this is free; it would not be later.
- **Nominal only.** No data moved, no column changed shape, every row kept its id, so
  foreign keys stayed valid throughout. Verified locally: 6 tables, 7 enums, all four
  constraints renamed, rows intact, and all 149 `npm run simulate` checks passing.
- **The naming law gained a retired-words entry**, so the next person to write `user` for
  this concept finds out why not.
