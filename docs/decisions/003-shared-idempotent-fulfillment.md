# 003 — One idempotent `ensureSubmission()`, two callers

**Status:** Accepted · Extends CLAUDE.md §9

## Problem

CLAUDE.md describes row creation as a job for the Stripe webhook alone. That
leaves a race it never addresses:

Stripe redirects the customer back to our upload page *immediately* on payment.
The `checkout.session.completed` webhook arrives independently — usually within
a second, sometimes later, occasionally after a retry. So the customer can be
standing on the upload page, ready to upload, before the row they need exists.

Two bad options if only the webhook may create rows: block the customer behind a
poll-and-wait spinner, or let the upload proceed and reconcile later.

## Decision

Extract row creation into a single function, `ensureSubmission(session)`, that
is **idempotent on the Stripe session ID**: it looks for an existing row first
and creates one only on a miss. It returns `{ record, created }` so callers can
tell which happened.

Both the Stripe webhook **and** the upload endpoint call it. Whichever arrives
first creates the row; the second finds it.

## Consequences

**The race disappears** rather than being handled. There is no ordering
requirement between the redirect and the webhook.

**Webhook retries are free.** Stripe retries on any non-2xx, and duplicate
deliveries are normal. A retry finds the existing row and returns `created:
false`.

**Emails don't double-send.** The payment-confirmation email is gated on
`created === true`, so it fires exactly once regardless of which caller won or
how many times Stripe retried.

**Cost.** Every upload-URL request spends one extra Airtable read looking for a
row that usually exists. At MVP volume this is nothing, and it stays well inside
Airtable's 5 req/sec ceiling.

**Constraint.** Any *future* path that creates a submission must go through this
function. Creating rows directly from a new call site reintroduces the race and
the double-email.
