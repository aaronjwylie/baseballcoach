# \_CommerceDocumentation — how money moves here

> **Scope:** this project only. Governed by [`_CommerceLaw.md`](../laws/_CommerceLaw.md), which holds
> the *rails*; this holds **our model, which rails bind, and which do not apply at this shape.**
>
> **If this contradicts Stripe, Stripe wins.**

---

## 1 · The northstar

### 1a · The economic model

```
customer ──one card payment──▶ Stripe ──▶ one submission moves to `new`
                                              │
                                         the admin pays the coach
                                         manually, outside the platform
```

**One payment buys one review of one pack of files.** No subscription, no credits, no balance, no
wallet, no refund flow, no payout rail. The price is a single integer in the `setting` table, editable
at `/admin/settings`.

**Where the margin is:** the spread between what the customer pays and what the admin pays the coach —
and **the second half is not in this system at all.** Coach payment happens by arrangement outside the
platform ([CLAUDE.md §2](../CLAUDE.md)), which is a deliberate non-goal, not an omission.

Two consequences that are easy to miss:

1. **There is no balance, so most of `_CommerceLaw` does not bind here** — see §1c. A law that mostly
   does not apply is still worth carrying, because the day a second payment shape appears is the day it
   starts applying, and it will apply from a cold start.
2. **Payment is the last step of the flow, not the first** ([ADR 009](../docs/decisions/009-upload-before-payment.md)).
   Nobody pays for a submission whose upload then fails. This inverts the usual ordering and is the
   single most important thing to know before changing the checkout.

### 1b · The words

| Concept | The word | Where it appears |
|---|---|---|
| the customer pays | **`paid`** | `paidAt` · `isPaid` · the `new` rung · the ② receipt |
| the money object | **PaymentIntent** | Stripe's own noun, kept — renaming a third party's object buys nothing |
| the price | **`priceCents`** | the `setting` row · never a literal in code |
| the moment it clears | **the boundary** | before it a scratch pad, after it a record |
| a failed attempt | **declined** | the decline email; the submission stays in `awaiting_payment` with its files intact |

**"Paid" is not a synonym for "complete."** Paid means money moved; complete means the coach delivered.
They are eleven rungs apart.

### 1c · What does not apply, and why

Stated explicitly so a future reader does not go looking for it:

| Rail | Applies? | Why |
|---|---|---|
| a ledger / journal | ❌ | there is no balance to reconcile. Stripe is the ledger; our row is a pointer to it |
| double-entry | ❌ | same |
| cash-out / payout | ❌ | the admin pays coaches outside the platform — [CLAUDE.md §2](../CLAUDE.md) |
| refunds | ❌ | not built. Issued by hand in the Stripe dashboard if ever needed |
| the two-rate spread | ❌ | one rate, one direction |

**If any row above ever becomes ✅, `_CommerceLaw` binds in full from that moment** — and the rails it
describes are cheaper to adopt before there is data than after.

---

## 2 · Where we are now — 2026-08-06 — the six properties

| # | Property | State |
|---|---|---|
| 1 | **One writer** | ✅ `markSubmissionPaid()` is the only function that flips a submission to paid. Two callers — the webhook and the browser confirming — one function |
| 2 | **The server owns the amount** | ✅ the PaymentIntent is created server-side from the `setting` row. The client sends nothing but a `submissionId`, and receives a `clientSecret` |
| 3 | **A debit is one statement** | **n/a** — there is no balance to decrement. The nearest analogue is the status flip, which is a single guarded update |
| 4 | **Idempotent by construction** | ✅ a submission already in a paid status is returned untouched. A Stripe retry, or the browser winning the race against the webhook, is a no-op. The receipt is gated on `justPaid` — [ADR 003](../docs/decisions/003-shared-idempotent-fulfillment.md) |
| 5 | **The announcement derives from the commit** | ✅ the receipt sends only when the flip actually happened, from inside the same function |
| 6 | **Every movement leaves a row** | 🔶 `submission_event` records the status transition and the receipt send. **Stripe holds the money truth**; we hold a pointer (`stripePaymentId`, unique) and a copy of the amount. There is no local ledger to reconcile *against*, so property 6 is satisfied in the weak sense — the trail can say what we believed, not independently verify what Stripe did |

**Payment is verified against Stripe, never against our own row.** A stale or forged row cannot mint an
upload. This is the rail that matters most here and it predates the pivot.

**The intent carries `metadata.submissionId` and nothing else.** The id is looked up; it is never
trusted to describe anything.

---

## 3 · The operator surface

| The admin can | Where | Guard |
|---|---|---|
| set the price | `/admin/settings` | `requireRole("admin")`. In the database, not env — it is the admin's value, not a deploy's ([ADR 012](../docs/decisions/012-retention-and-operator-settings.md)) |
| see that a payment landed | the queue, and the ② arrival email | — |
| **not** issue a refund | — | by design; the Stripe dashboard |
| **not** change a price after payment | — | `stripeAmount` is stamped on the submission at capture |

---

## 4 · Made mechanical

| Rail | How |
|---|---|
| idempotence | the function returns early on an already-paid status; there is no second path |
| the price is never a literal | `priceCents` on the `setting` row; no magic number in code |
| a webhook cannot be forged | `constructEventAsync` over the **raw** body; parse first and it breaks |
| test keys cannot reach production | separate keys **and** separate webhook secrets. A test-mode secret fails every signature check in production, loudly |

**Still memory:** that live keys and the live webhook are configured at all. Until they are, the funnel
cannot take money — the one remaining blocker at go-live ([OPERATIONS.md](../OPERATIONS.md)).

---

## 5 · Where we came from

- **Before 2026-07-30** — payment came *first*, then upload. A customer could pay and then fail to
  upload, which is the worst possible ordering of those two events. Inverted by
  [ADR 009](../docs/decisions/009-upload-before-payment.md).
- **Stripe Elements over hosted Checkout** ([ADR 005](../docs/decisions/005-stripe-elements-over-checkout.md))
  — payment stays on our page, under our branding. Costs us the card field's edge cases; buys the
  brand continuity the product is sold on.
- **The Mux `passthrough` trick is gone** ([ADR 002](../docs/decisions/002-passthrough-holds-record-id.md)).
  A submission's own uuid is the linkage key now, everywhere.
