# account — the ability to sign in

## The northstar

**An operator is a person in the business; an account is a capability granted to
them.** This domain owns the second: one table, `operator_credential`, and the
operations on a secret.

A coach can exist before anyone gives them a login. Until 2026-08-06 the schema
could not say that — `password_hash` was a column on the operator row, so the
two nouns shared a record and neither could be described without the other.

Invariants:

- **Everything here is keyed by an operator id.** This domain does not know what
  an email is or what a role is.
- **`api/credentialApi.ts` is the only file in `src/` that reads or writes
  `password_hash`**, and the only one that imports bcrypt. One grep confirms it.
- **`operator` imports `account`. `account` imports nothing from `operator`.**
  That direction is the whole design — see below.

## Why the direction is one-way — 2026-08-06

Two acts need a fact from both sides: **signing in** (an email → a person, then
a secret → a yes) and **creating a login** (a person, then a secret). If they
lived here, this domain would have to resolve emails, and the two would import
each other.

So they compose in **`operator`**, in `api/operatorCredentialApi.ts`, which is
allowed to import this. What arrives here is always an id and a secret.

The cost is that this slice has **no `ui/` segment**, and that is the split
working rather than a gap: every password *form* needs something this domain
refuses to know — the change form needs a session, the reset request needs an
email — so their actions live in `operator`, and a form belongs with its action.

**What left `operator` is the thing that mattered: the hash, and bcrypt.**

## What this cost, and why it was worth it

The split needed a schema change, and that is the point. The rules said two
concerns sharing a table cannot be two domains — which was true, and was
mistaken twice for an architectural conclusion when it was a **schema decision
nobody had questioned** ([`_StructureLaw` §5b](../../../laws/_StructureLaw.md)).

It is also better schema independently of folders: every `SELECT *` on an
operator was carrying a password hash into memory for a column almost nothing
reads.

## Where we are now — 2026-08-06

- ✅ `operator_credential` created and backfilled (`0013`) — verified 10 rows to
  10, zero drift between the old column and the new table.
- ✅ `password_hash` on `operator` made nullable (`0014`), so a new operator no
  longer writes it.
- 🔶 **The old column still exists.** Deliberate: migrations run *before* the
  build, so for a few seconds the previous deploy serves against the new schema.
  Dropping it in the same step is the 2026-08-02 outage exactly. A follow-up
  contracts it once `0013`/`0014` are live.
- ❌ **No `updatedAt` is surfaced anywhere.** The column exists and is written;
  nothing shows an admin when a password last changed, which is the first thing
  this table makes cheap and is worth doing when the portal grows a security
  view.

## Where we came from

- **Before 2026-08-06** — `password_hash` was a column on `operator`. The
  containment was real but conventional: one file read it, said so in its
  docblock, and nothing enforced the claim across a folder boundary because
  there was no boundary to cross.
- **2026-08-06, earlier the same day** — `operatorApi.ts` split into record and
  credentials, which made the hash's containment a *file* boundary. This is that
  same decision carried to its end: a table, a domain, and a dependency that
  points one way.
