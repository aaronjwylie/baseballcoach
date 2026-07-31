# 009 — Upload the files before paying

**Status:** Accepted and **built** (2026-07-30, Ben). Proposed 2026-07-29 by
Aaron; the flow now runs details → verify → upload → pay.

## Problem

The flow was **player info → pay (Stripe Elements) → upload video**. The
customer committed money *before* their video was safely in. If the upload then
failed — a big file, a flaky mobile connection — they'd paid for a submission
with no footage, and someone had to sort it out by hand. Payment is also the
step most likely to make a nervous first-time customer bounce, so putting it
before the easy "drop your video in" step front-loaded the friction.

## Decision

**Reverse it: collect player info → verify the email → upload files → pay.**
Payment becomes the last, most-committed step, and it only happens once we
actually hold the footage. "You've uploaded your clips — one last step to send
them to a coach" is an easier ask than "pay us, then we'll let you upload."

Two steps grew out of the consequences below rather than out of the original
proposal:

- **Email verification became step 2** ([ADR 010](010-verification-gates-upload.md)).
  The proposal called for "a short-lived signed upload token issued after the
  info step"; that is what the flow cookie is, but a token alone doesn't answer
  *who* is uploading. Verification does, and it also guarantees the address the
  feedback has to reach is one the customer can actually read.
- **Uploads go straight to Blob** ([ADR 011](011-client-direct-uploads.md)).
  Unrelated to the reordering, but it surfaced here: the old route could not have
  worked in production at any point in the flow.

## Consequences, and what each turned into

| Foreseen | How it was settled |
| --- | --- |
| "We'd store a file from an unpaid visitor. Needs a size cap, a rate limit, and a TTL sweep." | All three. The caps are operator-tunable in the database, and the sweep is a nightly Vercel Cron job ([ADR 012](012-retention-and-operator-settings.md)). |
| "The submission row is created at upload time, not payment time — a new state like `pending_payment`." | Created at **step 1**, earlier still. `awaiting_upload` was retired and replaced by `draft` → `awaiting_payment`; the webhook flips to `new`. |
| "Reworks `fulfillment`." | It did. `ensureSubmission` became `markSubmissionPaid` — same idempotency contract, opposite direction. [ADR 003](003-shared-idempotent-fulfillment.md) survives, retargeted. |
| "The upload route can't gate on a succeeded PaymentIntent." | It gates on the flow cookie plus a verified email. |
| "Abandoned-upload cleanup becomes a real requirement." | Agreed, and built as the sweep's second rule. |

## What it costs

Storage for people who never pay, bounded by the caps and the sweep. That is the
price of the trade and it was accepted knowingly: a customer who loses a 200 MB
upload after being charged is a refund, an apology, and a lost customer, which
costs more than a day of parked bytes.
