# 001 — Airtable is the database

**Status:** Accepted

## Problem

The platform needs to persist submissions, and the client needs to work through
them daily — assign coaches, paste feedback links, mark things done. The reflex
build is Postgres plus a custom admin UI.

## Decision

**Airtable is the database, and Airtable is the admin UI.** No Postgres, no
ORM, no admin dashboard.

## Consequences

**The admin panel costs nothing.** Filtering, sorting, views, search, mobile
access, permissions, and an audit trail all arrive free and already familiar.
A custom admin CRUD app would have been a meaningful slice of the budget and
would have been worse.

**The client can change the schema without us.** Adding an internal-notes column
is his to do. The flip side is that he can also *break* things — see below.

**Automations come with it.** The feedback-ready notification is an Airtable
automation calling our endpoint, which removed the need for Make.com in that
path entirely.

**Cost.** Real constraints we live with:

- **5 requests/second per base.** Fine at MVP volume; would not survive scale.
- **Field names are strings in our code.** A rename in the UI breaks the app
  silently. Mitigated by declaring each column name exactly once (the Step 1
  naming sweep) and by warning the client in OPERATIONS.md § Yuta's workflow.
- **No transactions, no constraints, no referential integrity.** Every read must
  treat every field as possibly absent.
- **Not a general query engine.** `filterByFormula` covers our four access
  patterns and little more.

**The exit.** All Airtable access goes through one module, so the day volume
outgrows it, a real database is a rewrite of that module rather than of the app.
The trigger to revisit is sustained traffic against the rate limit, or the
client wanting reporting Airtable can't express — not a hypothetical.
