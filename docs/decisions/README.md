# Architecture Decision Records

Short notes on decisions that a future reader would otherwise have to reverse-
engineer — especially the places where the implementation **departs from
[CLAUDE.md](../../CLAUDE.md)** on purpose.

A divergence without an ADR is a bug. A divergence with one is a decision.

| # | Decision | Status |
| --- | --- | --- |
| [001](001-airtable-as-db.md) | Airtable is the database | Accepted |
| [002](002-passthrough-holds-record-id.md) | Mux `passthrough` holds the Airtable record ID | Accepted — supersedes CLAUDE.md §7 |
| [003](003-shared-idempotent-fulfillment.md) | One idempotent fulfillment, two callers | Accepted — extends CLAUDE.md §9; retargeted by ADR 009 |
| [004](004-best-effort-email.md) | Transactional email is best-effort, never fatal | Accepted |
| [005](005-stripe-elements-over-checkout.md) | Stripe Elements, not hosted Checkout | Accepted — reaffirms CLAUDE.md §4 |
| [006](006-object-storage-over-mux.md) | Vercel Blob over Mux for download-only review | Accepted — supersedes Mux in CLAUDE.md §4/§7 |
| [007](007-portal-and-postgres-retire-airtable.md) | Operator portal + Postgres, retire Airtable | **Accepted — major pivot; reverses CLAUDE.md §1/§2, retires ADR 001/002** |
| [008](008-jose-sessions-over-authjs.md) | First-party jose sessions over Auth.js | Accepted — settles the ADR 007 auth sub-decision |
| [009](009-upload-before-payment.md) | Upload the files before paying | **Accepted and built — reverses the flow in CLAUDE.md §7** |
| [010](010-verification-gates-upload.md) | A verified email gates the upload | Accepted — replaces payment as the upload gate |
| [011](011-client-direct-uploads.md) | The browser uploads straight to Blob | Accepted — fixes a latent prod bug in CLAUDE.md §7's upload route |
| [012](012-retention-and-operator-settings.md) | Retention sweep, and limits the operator owns | Accepted — adds a table CLAUDE.md §8 didn't have |

## Format

Keep them short — problem, decision, consequences. If it takes more than a page,
the decision probably isn't made yet.
