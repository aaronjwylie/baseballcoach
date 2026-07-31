# 010 — A verified email gates the upload

**Status:** Accepted (2026-07-30, Ben). Follows from
[ADR 009](009-upload-before-payment.md).

## Problem

Payment used to be the gate on uploading: `/api/upload` verified a succeeded
PaymentIntent against Stripe, so nobody could store a file without having paid.
[ADR 009](009-upload-before-payment.md) moved payment to the end of the flow and
took that gate with it. Something has to stand between an anonymous visitor and
our storage bill.

It also exposed a second problem that had always been there. The customer's email
address is the **only** way we can deliver what they bought — there is no account
to log into, by design (CLAUDE.md §2). A typo in it was previously discovered
after the money was taken, when the payment receipt bounced.

## Decision

**Insert email verification as step 2, and make it the upload gate.** A 6-digit
code is emailed; entering it sets `emailVerifiedAt` on the submission and moves
it to `awaiting_payment`. Every upload route re-checks that flag.

The browser's claim to a submission is a **signed, httpOnly cookie** (`bs_flow`,
6 hours) carrying only the submission id. Verification state deliberately is *not*
in the cookie — it lives on the row, so there is one home for that fact and a
stale cookie can't assert a verification that never happened.

The code is stored **bcrypt-hashed**, expires in 10 minutes, is single-use, and
allows 5 attempts before it must be reissued. Issuing and verifying are both
rate-limited per IP.

## Why this is not a customer account

CLAUDE.md §2 rules out customer accounts, and this stays inside that line:

- no password, no profile, nothing to sign in to, no dashboard;
- the capability expires in hours and covers exactly one submission;
- a returning customer still identifies themselves the same way as before — by
  typing their email into `/status`, unverified.

It is a one-time proof of reachability, not an identity. If it ever grows a
"log in to see your past submissions" button, that line has been crossed and
this ADR should be revisited.

## Consequences

- **The flow cannot be completed without a working mail provider.** With
  `RESEND_API_KEY` unset, sends are skipped and logged (ADR 004) — which is
  honest degradation for a receipt, but a hard stop here. `.env.example` says so,
  and `npm run flow` exercises the path without email.
- **A customer who mistypes their email is stuck at step 2** — which is the
  point. "Wrong email? Go back" re-opens step 1, and editing the address clears
  any prior verification.
- **Two more round trips before the money.** Accepted: the alternative is a
  cheaper funnel that delivers feedback to addresses that don't exist.
