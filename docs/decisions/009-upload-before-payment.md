# 009 — Upload the video before paying

**Status:** Proposed (2026-07-29, Aaron) — UX change, **not yet built**. Recorded
so it isn't lost; the current build keeps pay → upload.

## Problem

Today the flow is **player info → pay (Stripe Elements) → upload video**. The
customer commits money *before* their video is safely in. If the upload then
fails — a big file, a flaky mobile connection — they've paid for a submission
with no footage, and someone has to sort it out by hand. Payment is also the
step most likely to make a nervous first-time customer bounce, so putting it
before the easy "drop your video in" step front-loads the friction.

## Decision (proposed)

**Reverse it: collect player info → upload the video → pay only after a
successful upload.** Payment becomes the last, most-committed step, and it only
happens once we actually hold the footage. "You've uploaded your video — one last
step to send it to a coach" is an easier ask than "pay us, then we'll let you
upload."

## Consequences / open questions

- **We'd store a file from an unpaid visitor.** Needs an abuse guard: a size cap,
  a rate limit, and a TTL sweep that deletes uploads that never get paid for.
- **The submission row is created at upload time**, not payment time — a new
  state like `pending_payment`, with the Stripe webhook flipping it to
  `awaiting_review`/`new` on success. Reworks `fulfillment` and the status enum.
- **The upload route can't gate on a succeeded PaymentIntent** (there isn't one
  yet). Gate on a short-lived signed upload token issued after the info step.
- Abandoned-upload cleanup becomes a real requirement, not a nicety.

## Status

A future slice. Left as pay → upload for now so this cutover stays scoped to
storage + persistence, not a flow redesign.
