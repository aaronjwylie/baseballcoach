# 012 — Retention sweep, and limits the operator owns

**Status:** Accepted (2026-07-30, Ben + Yuta). Settles the abuse guard
[ADR 009](009-upload-before-payment.md) called for.

## Problem

Taking files before taking money means storing files for people who never pay.
Left alone that grows forever, and we pay for it. Completed reviews accumulate
too: once a coach has delivered feedback, the source video has done its job.

The limits involved — how big a file, how many, how long to keep them — are
**business judgements Yuta will want to change**, not engineering constants. A
redeploy to change a number is a bottleneck with one developer and a client in
another timezone.

## Decision

### Limits live in Postgres, not in env

A single-row `settings` table holds four numbers, edited at `/admin/settings`:

| Setting | Default |
| --- | --- |
| `maxFileSizeMb` | 50 |
| `maxFilesPerSubmission` | 5 |
| `retainResolvedHours` | 24 |
| `retainUnpaidHours` | 24 |

**Env vars are the developer's configuration; these are the operator's.**
Different owner, different lifetime, different home. `shared/config/env.ts` keeps
its rule — it is still the only place `process.env` is read — and these simply
aren't env.

### A nightly sweep, with two rules

`/api/cron/sweep` runs at 04:00 UTC (`vercel.json`), guarded by `CRON_SECRET`:

- **resolved** — a `complete` submission's uploads go `retainResolvedHours`
  after it completed;
- **abandoned** — an unpaid submission's uploads go `retainUnpaidHours` after it
  was opened.

### Two things the sweep never does

**It never touches the coach's feedback file.** The customer's only route to
what they bought is the link in their email, and that link has to keep working.
Sweeping `feedbackUrl` a day after completion would delete the deliverable.

**It never deletes the file records.** Rows in `submissionFiles` survive with
their locator cleared, so the portal and the receipt can still say what was sent.
A silently shorter list looks like data loss; "three files, deleted under the
retention policy" is information. `/api/files/[id]` answers **410 Gone** rather
than 404 for the same reason.

## Consequences

- **`CRON_SECRET` unset means the route refuses to run** (503), rather than
  running unguarded. This is the one place in the app where absent config must
  not degrade gracefully — it deletes customer data.
- **A coach who sits on a review past the window loses the source files.**
  Mitigated by the sweep keying off `completedAt`, not assignment: the clock
  only starts once they've delivered.
- **The rate limiter is still per-instance** (`shared/lib/rateLimit.ts` is honest
  about this). The caps are the real defence against a determined uploader; the
  limiter only stops a naive loop.
