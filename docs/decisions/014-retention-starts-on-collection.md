# ADR 014 — Retention starts when the customer collects

**Date:** 2026-08-01
**Status:** accepted
**Amends:** [ADR 012](012-retention-and-operator-settings.md), which keyed the clock off completion.

## Context

Files were deleted 24 hours after a submission was marked complete. Two problems.

**It deleted things the customer may never have seen.** "Complete" means *we
sent it*, not *they have it* — a parent who didn't check their email for two days
lost the review they paid for.

**It forced an exception.** Because the clock ran from delivery, the coach's
response had to be excluded from the sweep or customers would lose the
deliverable. So the response lived forever, and "what do we actually delete" had
two answers.

## Decision

**The clock starts on collection.** 30 days from the customer's first download,
or 90 from delivery for the customer who never comes — **whichever ends later**,
so someone who collects on day 80 still gets their full window.

**Everything is swept together**, the coach's response included. This is only
safe *because* of the line above: we never delete anything the customer hasn't
already got in hand. The exception disappears, and with it the second answer.

**A warning precedes deletion** by a week, and it is the one genuinely
*scheduled* effect in the system. Everything else the sweep does is derivable
from state — "delete what's due" needs no memory — but "warn a week out" is a
one-off that must fire exactly once.

## Consequences

- **The warning runs before the purge in the same sweep, against a nearer
  cutoff.** Run the other way round, a single night could both warn and delete —
  a warning in name only. Ordering the two passes *is* the guarantee.
- **The warning is stamped whether or not the send succeeded.** Retrying nightly
  would turn one missed email into seven, which is worse than the miss. This is
  the opposite call from the verification code, which fails the flow rather than
  proceed — and for the opposite reason: nobody is *blocked* on a warning.
- **The deadline is stated at delivery**, in ⑥, not sprung in the warning. A
  deadline disclosed up front is a term of the service; disclosed a week out it
  is a surprise. Those two messages are now the only protection against a parent
  losing a review they cannot recreate, so neither is optional.
- **A customer who never collects is still bounded**, by the 90-day backstop.
  Without it their files would live forever — the safe failure, but unbounded
  storage.
- Abandonment now measures from `updatedAt` rather than `submittedAt`, so a
  customer still working — or one whose card just failed — isn't reaped mid-flow.

## The line to watch

If retention ever moves back to keying off delivery, **sweeping the response
becomes wrong again**. The end-to-end flow test asserts that the response is
swept, and should start failing if that happens.
