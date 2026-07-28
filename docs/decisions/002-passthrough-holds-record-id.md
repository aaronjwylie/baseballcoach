# 002 — Mux `passthrough` holds the Airtable record ID

**Status:** Accepted · Supersedes CLAUDE.md §7 as originally written

## Problem

When Mux finishes processing a video it fires `video.asset.ready`. The handler
has to find the Airtable row that video belongs to. Mux's `passthrough` field is
the only value we control that survives the round trip, so whatever we put in it
*is* the linkage.

CLAUDE.md §7 specified the Stripe payment intent ID.

## Decision

Put the **Airtable record ID** in `passthrough` instead.

We already have it: the upload endpoint calls `ensureSubmission()` before
creating the Mux upload (see [ADR 003](003-shared-idempotent-fulfillment.md)),
so the row exists by the time we need a value.

## Consequences

**Better.** The webhook does `GET /v0/{base}/{table}/{recordId}` — a direct
fetch. The payment-ID version would need `filterByFormula={Stripe Payment ID}='…'`,
which means: a search across the table rather than a keyed read, a formula
string built from external input (escaping surface — see the `escapeFormulaValue`
helper), and an ambiguous result shape where a miss and a match look the same.

**Cost.** The row must exist before the upload URL is minted. That's already
true and enforced, but it's a real ordering constraint — don't create Mux
uploads outside that path.

**Fallback.** If `passthrough` is ever absent, the handler falls back to a
lookup on `Mux Upload ID`, which the upload endpoint stores on the row. Belt and
braces; it has not been observed to trigger.

**Unaffected:** the payment linkage still lives on the row itself, so tracing a
video back to its payment is one field read away.
