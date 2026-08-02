# ADR 013 — The status ladder, and an event trail beside it

**Date:** 2026-08-01
**Status:** accepted
**Supersedes:** nothing. Extends the lifecycle described in [ADR 007](007-portal-and-postgres-retire-airtable.md).

## Context

The lifecycle had seven statuses, and Yuta could not see where a submission was
stuck. `in_review` meant "we emailed the coach", not "a coach is working", so a
coach sitting on a review for three days looked identical to one halfway through
it — and turnaround was unmeasurable because nothing marked the moment work
began.

Several stages were likewise invisible: whether a translation had gone out,
whether the customer had ever collected their feedback, whether a deletion was
imminent. Each was a question the queue couldn't answer, so each became something
a person had to remember.

## Decision

**Sixteen statuses, in ladder order**, one per stage that changes the world —
and **`submission_events`**, one row per transition, beside them.

The enum's own order matches the ladder's, so `ORDER BY status` means "how far
along" without a lookup table.

Three rungs carry the weight: `new` (paid — the boundary), `in_review` (**the
coach actually has the files**, earned by their first download), and `collected`
(**the customer has downloaded it**, which starts the retention clock).

### Why an events table rather than sixteen timestamp columns

"Every status has a timestamp" reads literally as sixteen nullable columns on a
wide, sparse table. The events table answers everything those would, and adds
what they structurally cannot:

- **Repeats.** An operator can now reset a status, so a submission can reach the
  same rung twice. A column keeps one of those moments and silently loses the
  other.
- **Who.** A column records that something happened, never who did it.
- **The shape of the work.** Time-in-stage and coach turnaround become arithmetic
  on rows we're already writing, rather than a reporting feature built later.

`submissions.status` stays as the *current* value, so every existing query is
unaffected. Two columns — `collectedAt` and `deletionWarnedAt` — deliberately
duplicate facts the trail also holds, because the nightly sweep scans on them and
a scan against a join is one we'd have to justify at every row.

### Two rules that came out of building it

**The actor is read from the session, not passed in.** Every caller would
otherwise have to remember a parameter, and the one that forgets writes an
anonymous event indistinguishable from a legitimate one. Null is meaningful: the
customer's four steps and the cron genuinely have no session.

**A question about the ladder is a predicate, never a comparison.** Thirteen call
sites asked *may the customer see this?* by writing `status === "complete"` —
true until `collected` existed, and then false **the instant a customer
downloads**, revoking their own access by using it. No type error, no failing
test. Every such question is now an exhaustive `Record<SubmissionStatus, boolean>`,
which makes adding a rung without answering a compile error.

## Consequences

- Nine new enum values, one migration (`0008`). All are paid — the ladder only
  branches after step 4 — and the compiler forced each answer.
- The customer-facing lookup collapses eleven middle rungs into one sentence. A
  parent has no use for `response_translating`, and that collapse lives in one
  function.
- **The ladder is a path with branches, not a progress bar.** Four rungs are only
  touched when a submission needs translating; anything rendering it as a linear
  track will be wrong for most submissions.
- The migration was nearly free because there were no real customers. It would
  have needed a careful, reversible, data-preserving plan a week later.
