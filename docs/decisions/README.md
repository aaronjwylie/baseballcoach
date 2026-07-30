# Architecture Decision Records

Short notes on decisions that a future reader would otherwise have to reverse-
engineer — especially the places where the implementation **departs from
[CLAUDE.md](../../CLAUDE.md)** on purpose.

A divergence without an ADR is a bug. A divergence with one is a decision.

| # | Decision | Status |
| --- | --- | --- |
| [001](001-airtable-as-db.md) | Airtable is the database | Accepted |
| [002](002-passthrough-holds-record-id.md) | Mux `passthrough` holds the Airtable record ID | Accepted — supersedes CLAUDE.md §7 |
| [003](003-shared-idempotent-fulfillment.md) | One idempotent `ensureSubmission()`, two callers | Accepted — extends CLAUDE.md §9 |
| [004](004-best-effort-email.md) | Transactional email is best-effort, never fatal | Accepted |
| [005](005-stripe-elements-over-checkout.md) | Stripe Elements, not hosted Checkout | Accepted — reaffirms CLAUDE.md §4 |
| [006](006-object-storage-over-mux.md) | Vercel Blob over Mux for download-only review | Accepted — supersedes Mux in CLAUDE.md §4/§7 |
| [007](007-portal-and-postgres-retire-airtable.md) | Operator portal + Postgres, retire Airtable | **Accepted — major pivot; reverses CLAUDE.md §1/§2, retires ADR 001/002** |

## Format

Keep them short — problem, decision, consequences. If it takes more than a page,
the decision probably isn't made yet.
