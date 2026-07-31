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
| **Session expiry** — abandon an unfinished attempt | 10 min, sliding | the flow cookie's own TTL. No scheduler: an expired token simply fails to verify |
| **Deferred cleanup** — delete uploads after a review completes | `retainResolvedHours` | the hourly sweep, comparing against that submission's own `completedAt` |
| **Deferred cleanup** — delete an abandoned submission's uploads | `retainUnpaidHours` | same sweep, against its own `submittedAt` |

Both cleanup clocks are **relative to the submission**, never to a wall-clock
schedule — "24 hours after *it* completed", not "at 4am". The cron cadence is a
separate question: the job can only notice an elapsed window when it runs, so a
daily job silently turned 24 hours into 24–48. It runs hourly for that reason.

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
