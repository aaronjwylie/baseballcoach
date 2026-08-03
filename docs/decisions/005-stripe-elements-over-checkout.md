# 005 — Stripe Elements, not hosted Checkout

**Status:** Accepted (2026-07-28, Ben) · Reaffirms CLAUDE.md §4

## Problem

The first build shipped Stripe's **hosted Checkout**: the customer fills in the
player-info form, we create a Checkout Session server-side, and hand them off to
`checkout.stripe.com`, which redirects back to the upload page on success.

CLAUDE.md §4 locks **Elements** (embedded `<PaymentElement>`). So this needed
deciding rather than inheriting.

The honest case for hosted Checkout: it works today, it's less code, wallets and
Link come free, and the "lean validation" northstar says don't gold-plate. It is
also **not unbranded** — Stripe's Dashboard branding settings carry a logo,
colours, fonts, and corner shapes, and custom domains are available.

## Decision

**Rebuild on Elements.**

The branding controls aren't the point. The difference that matters is that
hosted Checkout is a *full-page handoff to another domain* — we control neither
the layout, the surrounding copy, nor the URL bar. Elements keeps payment as a
step **inside** the product: our page, our order summary, our reassurance copy,
our domain, one continuous flow.

For a service asking a parent to pay $149 up front to strangers overseas, the
moment of payment is where trust is won or lost. It's part of the platform
experience, not an errand run off-site.

## Consequences

**Work required.** `/api/checkout` becomes `/api/stripe/create-intent` returning
a `clientSecret`; a new payment step renders `<PaymentElement>`; the webhook
event moves from `checkout.session.completed` to `payment_intent.succeeded`; a
new `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Roughly a Sprint-2 redo.

**One migration, not two.** The linkage key changes from `Stripe Session ID` to
a payment-intent ID — which is already a column rename inside the Step 1 naming
sweep. Doing Elements now folds it into that single migration of the admin's live
base instead of requiring a second one later.

**PCI posture is unchanged.** Elements iframes the card fields, so SAQ-A still
applies. We never touch card data either way.

**Wallets need explicit config.** Apple/Google Pay and Link are on by default in
hosted Checkout; with `PaymentElement` they're supported but must be enabled.
Worth doing — mobile is the primary device here.

**Unchanged:** `ensureSubmission()` keeps its shape ([ADR
003](003-shared-idempotent-fulfillment.md)), and the upload endpoint keeps
verifying against Stripe directly — `paymentIntents.retrieve` in place of
`checkout.sessions.retrieve`.
