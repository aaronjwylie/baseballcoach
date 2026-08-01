# settings — `src/domains/settings/`

The **settings slice** — the limits Yuta tunes without a deploy.

---

## 1 · The northstar

Four numbers, one row, one admin form:

| Setting | Default | What it governs |
| --- | --- | --- |
| `maxFileSizeMb` | 50 | the largest single upload |
| `maxFilesPerSubmission` | 5 | how many files one submission carries |
| `retainResolvedHours` | 24 | when a completed review's uploads are deleted |
| `retainUnpaidHours` | 24 | when an abandoned submission's uploads are deleted |

### The timers, and why they aren't one mechanism

Three clocks govern a submission, and they are implemented three different ways.
Worth knowing before anyone asks for "a timer in admin":

| Clock | Value | How it's enforced |
| --- | --- | --- |
| **The flow window** — one clock for the whole unfinished attempt | **30 min**, sliding *(today: 10, plus a second 10-min clock on the verification code — see below)* | the flow cookie's own TTL. No scheduler: an expired token simply fails to verify |
| **Deferred cleanup** — a completed review's uploads | `retainResolvedHours` | the nightly sweep, against that submission's own `completedAt`. Files go, **record stays** |
| **Deferred cleanup** — an abandoned submission | `retainUnpaidHours` | the sweep *and* every new submission. **Deleted outright** — files and record |

**One window covers the whole attempt.** The verification code does *not* get an
expiry of its own — it lives and dies with the flow window, and a resent code
inherits whatever time is left rather than starting a new 30 minutes. A customer
should be able to hold one number in their head ("I have half an hour"), not
discover a second, shorter clock they were never told about.

⚠️ Today there are two: a 10-minute session **and** a separate 10-minute code TTL,
enforced independently in `domains/verification`. Collapsing them is part of the
one-clock rework.

Both cleanup clocks are **relative to the submission**, never to a wall-clock
schedule — "24 hours after *it* completed", not "at 4am".

The two are not symmetrical, and shouldn't be. A paid submission's history
matters, so its record survives its files. Nothing was ever bought in the
abandoned case, so **nothing is retained** — a kept row would just be noise in
the queue.

**Running out is not an error — it's a scrub.** When the window lapses, or the
verification attempts are exhausted, the unfinished submission is discarded exactly
as a refresh discards it, and the customer is returned to step 1. One outcome, three
routes to it; the flow never leaves someone standing on a step whose submission is
gone. ⚠️ Not built — today an expiry surfaces as an inline error in place.

**Only the resolved clock depends on the cron.** Vercel's Hobby plan permits one
cron run a day, so "24 hours after completion" is 24–48 in practice; hourly needs
Pro. The abandoned clock sidesteps that entirely — `startSubmissionAction` sweeps
unpaid submissions as well, so the flow cleans up after itself whenever anyone
starts one. With no traffic nothing is running anyway, and with traffic the cron
is only a backstop.

⚠️ **The proposed retention rework changes all of this.** The northstar path now
keys the resolved clock off the *customer's download* (30 days) rather than off
completion (24h), and adds a **one-week warning email** before deletion. That
warning is the "fourth kind" below — the first genuinely scheduled effect in the
system — so it can't be folded into the existing derivable sweeps. See
[`submission/_SubmissionDocumentation.md` §2](../submission/_SubmissionDocumentation.md).

**A fourth kind doesn't exist yet and isn't cheap.** "Email the coach if a
submission sits untouched for 48h" is not another row here — nothing on the
submission implies it, so it needs per-item scheduled state, once-only delivery,
and a decision about what happens when the submission changes while the timer is
pending. The two kinds above are cheap precisely because they're *derivable* from
a timestamp already on the row. Add named timers when a concrete one is wanted;
a generic rules engine is the platform build-out CLAUDE.md §2 rules out.

### Why these aren't env vars

**Env vars are the developer's configuration; these are the operator's.**
Different owner, different lifetime, different home. A redeploy to change "how
many files" is a bottleneck with one developer and a client in another timezone —
and these are business judgements, not engineering constants.

`shared/config/env.ts` keeps its rule intact: it is still the only place
`process.env` is read. These simply aren't env.

### The invariants

- **One row, always.** `SETTINGS_ID` is fixed, so the table cannot grow a second.
  `getSettings()` creates it on first read rather than returning defaults, so the
  admin form always has something to edit.
- **The schema bounds the knobs.** 1–2000 MB, 1–20 files, 1 hour to a year. The
  ceilings stop a typo turning one upload into a storage bill; the retention floor
  stops an operator setting a sweep so aggressive it deletes files out from under
  a coach who is still working.
- **Read through `getSettings()`, which is `cache`d per request.** The upload
  route, the flow page, and the sweep all ask; they share one query.

---

## 2 · Where we are now — 2026-07-30

- ✅ **Built**, with the admin form at `/admin/settings`.
- ✅ **Enforced server-side on every upload** — the browser is told the limits so
  it can be helpful, never trusted to apply them.
- 🔶 **No audit trail.** `updatedAt` records *when*, not *who* or *what it was*.
  With one admin that's proportionate; with several it wouldn't be.
- 🔶 **Changing a limit doesn't affect files already stored.** Lowering the size
  cap won't retroactively delete an oversized upload, and lowering the file count
  won't trim an existing submission. That's deliberate — retroactive deletion on a
  settings save would be a nasty surprise — but it's worth knowing.
- 🔶 **Retention changes take effect on the next nightly sweep**, not immediately.

---

## 3 · Where we came from

New on 2026-07-30, created because
[ADR 009](../../../docs/decisions/009-upload-before-payment.md) needed an abuse
guard and Yuta asked for the numbers to be his rather than ours
([ADR 012](../../../docs/decisions/012-retention-and-operator-settings.md)).

- **A single-row table, not a key/value store.** Four typed columns beat four
  rows of `(key, value::text)` that every caller has to parse and none of which
  the database can constrain.
- **Its own slice rather than living in `account`.** These are platform settings,
  not operator identity; the only thing they share is that an admin edits them.
