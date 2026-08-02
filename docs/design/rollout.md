# Rollout — from what's deployed to the northstar pipeline

The northstar is [`domains/submission/_SubmissionDocumentation.md` §2](../../src/domains/submission/_SubmissionDocumentation.md):
seventeen stages, sixteen statuses, nine emails. This is the route from what runs
in production today to that, in the order the dependencies actually allow.

**Read the path doc for *what*; read this for *when and why in this order*.**
Nothing here is new design — every item traces to a `(not built)` marker or a
`(today: …)` divergence already recorded there. If something in this plan isn't in
that doc, one of the two is wrong.

_Written 2026-08-01, against `main` @ `126c8a4`._

---

## 1 · Where we actually are

Seven stages of seventeen run end to end in production. The customer funnel is
complete through payment; the operator loop works but is blind in places; nothing
after delivery exists.

| Stage | State |
| --- | --- |
| 1–4 details → verify → upload → pay | ✅ **built and walked in a browser** |
| 5 coach assigned | ✅ built — minus the translation derivation |
| 6–7 originals translated | ❌ nothing |
| 8 handed to the coach | 🔶 built, but sends everything and jumps to `in_review` |
| 9 coach downloads | ❌ nothing |
| 10 coach delivers | ✅ built — multi-file, direct-to-Blob, approval gate. **No email** |
| 11–12 response translated | ❌ nothing |
| 13 approved & sent | 🔶 built — no language choice, no retention copy |
| 14 customer downloads | 🔶 the *link* is built; the **stamp** isn't |
| 15 resolved | ❌ nothing |
| 16 deletion warning | ❌ nothing |
| 17 files purged | 🔶 sweeps customer uploads only, on the old 24h clock |

### What landed on 2026-08-01, and what it means for this plan

Four commits moved the needle more than their size suggests:

- **A signed capability token** (`domains/feedback/api/feedbackToken.ts`) — purpose-bound,
  unforgeable, one year. **This is half of the northstar's magic link**, and the
  hard half: the crypto, the purpose binding, and the route that consumes it all
  exist. Extending it to a *status* capability is a second purpose, not a new
  mechanism.
- **`submissionFiles.kind`** — one table, two roles, kept apart by a discriminator.
  **This is the four-folder model's foundation**, already carrying two of the four
  values.
- **Multi-file coach feedback** — the response is a pack, like the submission. The
  path doc assumed this; now it's true.
- **The status lookup stopped serving feedback.** It says "we've emailed you a
  private link" instead. That closes the hole where an unverified email could
  collect a stranger's review — the sharpest security gap the doc recorded.

**Two things landed that now contradict settled decisions.** Neither is a mistake;
both predate the decision. They need resolving before the phase that touches them:

1. **"The coach's feedback file is never swept"** — stated in `retentionSweep.ts`
   and in the token's own comment. The settled northstar is **everything is swept
   together** (step 17), which is only safe because the clock starts on collection.
   Phase 6 changes this; until then the two documents disagree and the code wins.
2. **The token lives a year; the files won't.** With 30-day-from-collection
   retention, a link mailed today resolves to **410 Gone** long before it expires.
   That's defensible — the route already answers 410 — but it should be a decision,
   not a leftover. **Settled 2026-08-01: the year stays.** A link that says "this has
   been deleted" is a kinder answer than one that says "invalid", and the route already
   distinguishes them.

### The naming collision — settled

`submissionFiles.kind` shipped as **`submission` / `feedback`**; the settled status
names use **`intake_*` / `response_*`** for the same two concepts. **The decision is
`intake` / `response` everywhere** — the shipped values get renamed, not the statuses.

It costs a data migration the other direction wouldn't have. It buys a vocabulary
that survives: *intake* and *response* say **who the files came from**, which is the
distinction that actually matters, while `submission`-inside-`submissionFiles` says
almost nothing. The full vocabulary is now [`_NomenclatureLaw.md`](../../_NomenclatureLaw.md).

**Grammar keeps the two axes apart** where the stem is shared — a file kind is a
**noun** (*what is this file*), a status is a **participle** (*what has happened*):

| | File kind | Status |
| --- | --- | --- |
| customer's files | `intake` · `intake_translation` | `intake_translating` · `intake_translated` |
| coach's files | `response` · `response_translation` | `response_translating` · `response_translated` |

So `kind === 'intake_translation'` never reads as `status === 'intake_translated'`.

⚠️ Phase 1 now carries the rename: `UPDATE submission_files SET kind = 'intake' WHERE
kind = 'submission'` and the same for `feedback` → `response`. Small, but it touches
live rows — and it must land **in the same migration as the enum**, so the two
vocabularies never coexist in a deployed state.

---

## 2 · How the phases are ordered

Three rules decided the sequence, in this priority:

1. **Nothing destructive ships before the handle that undoes it.** Operator
   override (Phase 5) precedes the retention rework (Phase 6). Yuta gets the manual
   purge and the status reset *before* the system starts deleting more, on a longer
   clock, with a warning email.
2. **The record before the behaviour.** Phase 1 is schema only — no visible change,
   everything after depends on it. Building step 9's download stamp against a status
   enum that can't express `sent_to_coach` means building it twice.
3. **Cheapest trust first.** Phase 2 is five small fixes that each stop a customer
   being silently stranded. Best value per hour in the whole plan, and none of it
   blocks anything else — it can run in parallel with Phase 1.

---

## Phase 0 · Take money

*Not pipeline work, but it gates everything. Already scoped in [OPERATIONS.md](../../OPERATIONS.md).*

- Live Stripe keys + the `payment_intent.succeeded` webhook
- Clear `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` when the site should be reachable
- Confirm `NEXT_PUBLIC_SITE_URL` is the `www` host — it's inlined at build time, so
  changing it needs a redeploy
- Real coach content and photography for the landing page
- One human test of the card field and 3-D Secure

**Until this is done, every phase below is preparation for a product that can't
take an order.** It should not wait on any of them.

⚠️ **But Phase 1's migration should land before this does.** There are no real
customers yet, which makes a sixteen-value enum change nearly free; the first real
payment closes that window permanently. Phase 0 is operations and Phase 1 is code,
so they run in parallel — the constraint is only on the order they *finish*.

---

## Phase 1 · The spine of record — ✅ **shipped 2026-08-01**

**Schema only. Nothing visible changes; almost everything after depends on it.**

| | Ships | |
| --- | --- | --- |
| 1.1 | Status enum: seven values → sixteen | ✅ migration `0008` |
| 1.2 | `submission_events` table — `submissionId` · `status` · `at` · `actorId` · `note` | ✅ |
| 1.3 | Every existing transition writes an event | ✅ in `updateSubmission`, the one write path |
| 1.4 | `submissionFiles.kind`: rename `submission`→`intake`, `feedback`→`response`, then extend to four | ✅ now a `file_kind` enum |
| 1.5 | The paid-ness `Record` answers all sixteen | ✅ — **and three more like it** |
| 1.6 | The customer status lookup collapses sixteen states into calm language | ✅ eleven rungs → one sentence |

### What the build surfaced that the plan didn't

**The hazard was worse than "grep before, not after".** Thirteen call sites compared
`status === "complete"` to mean *the customer may see this*. The moment `collected`
exists, that comparison goes false **the instant a customer downloads** — they would
have revoked their own access by using it. None of it is a type error; all of it is
silent.

The fix is the `isPaid` lesson applied three more times: **derived predicates over
literal comparisons**, each an exhaustive `Record<SubmissionStatus, boolean>` so a
new rung can't be added without answering.

| Predicate | Asks | Replaces |
| --- | --- | --- |
| `isReleased` | may the customer see it? | `status === "complete"` (13 sites) |
| `hasResponse` | has the coach delivered? | `awaiting_approval \|\| complete` |
| `isWithCoach` | is it on a coach's desk? | `assigned \|\| in_review` |

**The actor is read from the session, not passed in.** Every caller would otherwise
have to remember a parameter, and the one that forgets writes an anonymous event
indistinguishable from a legitimate one. Reading it inside the event writer makes the
right answer the default; null is meaningful — the customer and the cron genuinely
have no session.

**The trail is transactional, not best-effort.** `updateSubmission` reads the
previous status, writes, and stamps, all in one transaction — so the history cannot
disagree with `submissions.status`, and a *repeated* set (a redelivered webhook, a
double-clicked button) produces no second event. That read-before-write is the extra
query earning its place.

**Verified** by walking one submission through all sixteen rungs: twelve changes
produced twelve events, a repeat produced none, a non-status patch produced none,
ordering held, and the events cascaded on delete.

**Why first:** three later phases say "the status moves to X". None can be built
honestly against an enum that can't say X.

**Why it's safer than it looks:** paid-ness is a `Record<SubmissionStatus, boolean>`,
so adding a status without answering "is this paid" is a **compile error**. That's
how `awaiting_approval` was caught. All nine new values are paid — the ladder only
branches after step 4.

**The risk that isn't compile-checked:** every admin filter and query that names a
status. `in_review` in particular changes meaning — from "we emailed the coach" to
"the coach has the files" — and `sent_to_coach` takes over the old sense. Grep
before, not after.

**Verifiable when:** the seed runs, the admin queue renders every existing
submission unchanged, and `submission_events` has a row per historical transition
we can reconstruct (or is deliberately empty before the cutover — decide which).

---

## Phase 2 · Stop stranding customers

**Five small independent fixes. Can run in parallel with Phase 1 — no shared
files.** Every one of them is a case where the product currently fails silently.

| | Ships | Size | Fixes |
| --- | --- | --- | --- |
| 2.1 | `{ ok: false, gone: true }` — the flow resets to step 1 on a scrubbed submission instead of showing an inline error | S | a customer uploading into a submission the server swept |
| 2.2 | One clock — `CODE_TTL_MINUTES` follows the flow window; a resend inherits the remainder | S | a code that dies while the session is alive |
| 2.3 | The code send is confirmed before the customer advances | S | a missing key leaves them waiting for a code that never comes |
| 2.4 | "Check your spam folder" on step 2 | XS | the common case, uncaught |
| 2.5 | A declined card emails a way back, and extends the window | S | files swept out from under a customer finding another card |

**Why so early:** all five are live-customer-facing the moment Phase 0 completes,
and none needs the new schema. 2.1 is the largest and the most valuable — it's the
difference between a scrub being *visible* and being *silent*.

---

## Phase 3 · Make the queue tell the truth

**Yuta's visibility. Depends on Phase 1.**

Five of the nine emails tell Yuta something, and four of those don't exist. Today
he learns that a payment landed, that a coach picked work up, that a response is
waiting, and that a customer collected — **by looking.**

| | Ships | Size |
| --- | --- | --- |
| 3.1 | Step 8 sets `sent_to_coach`, not `in_review` | S |
| 3.2 | **Step 9** — the coach's first download stamps, moves to `in_review`, emails ④ | M |
| 3.3 | Step 10 emails ⑤ — Yuta *and* the coach | S |
| 3.4 | **Step 14** — the customer's first download stamps, moves to `collected`, emails ⑦ | M |
| 3.5 | Step 4's ② also goes to Yuta | S |
| 3.6 | Server-side status guards on steps 5 and 10 — today UI-only | S |

**Build 3.2 and 3.4 together.** They are the same mechanism at opposite ends: a
download is confirmed, a status or clock moves, Yuta is told. Written twice they
will drift.

**The asymmetry to respect:** a coach who never downloads leaves a **visible stuck
row** — that's the feature. A customer who never downloads leaves silence, which is
why Phase 6 needs a backstop and this phase doesn't.

**Verifiable when:** a submission walks assign → hand-off → coach download →
deliver → approve → customer download, and Yuta's inbox has four new messages he
previously had to go looking for.

---

## Phase 4 · Language

**The four folders and the two curation gates. Depends on Phase 1.4.**

| | Ships | Size |
| --- | --- | --- |
| 4.1 | Admin file view shows four sets by `kind` | M |
| 4.2 | Step 5 derives translation need from the coach's languages | S |
| 4.3 | **Steps 6–7** — download originals, upload translations, two statuses | M |
| 4.4 | **Steps 11–12** — the same, for the response | S — *4.3's shape, reused* |
| 4.5 | Step 8's radio: English · Japanese · both; records the choice; sends only that | M |
| 4.6 | Step 13's radio: the same, for the customer | S — *4.5's shape, reused* |

**Why after Phase 3:** it's the largest block of new UI and the least urgent — the
platform functions without it, in English, today. Everything in Phase 3 is a
failure the product already has.

**Why assignment precedes translation:** translation need is derived from the
coach, so the coach must be known first — and translating for a coach who then
isn't assigned is money spent for nothing. This is why the path doc renumbered.

**Both radios sit on a *send*, never on an earlier step**, because at assignment
the translation doesn't exist yet to choose. 4.5 and 4.6 are one component used
twice.

---

## Phase 5 · Operator control

**The handle, before the automation that needs it. Depends on Phase 1.**

| | Ships | Size |
| --- | --- | --- |
| 5.1 | Purge any of the four folders now, without waiting for a clock | S |
| 5.2 | Reset a status to any earlier rung | S |
| 5.3 | Both write to `internalNotes` and `submission_events` with the actor | S |
| 5.4 | Step 15 — "Mark resolved" + the ⑧ thank-you | S |

**Why before Phase 6, not after.** Phase 6 makes the system delete more, later,
with a warning nobody has seen fire. Yuta should be able to purge on demand and
walk a status backwards **before** that ships, not after the first thing goes wrong.

5.4 rides along because it's the same admin surface and the same event-writing
shape.

---

## Phase 6 · The ending

**Retention and deletion. Depends on Phase 3's `collected` stamp — without it the
clock never starts and nothing is ever purged.**

| | Ships | Size |
| --- | --- | --- |
| 6.1 | Clock moves from `completedAt` +24h to **collection +30d, or delivery +90d, whichever is later** | M |
| 6.2 | Step 13's ⑥ states the retention window at delivery | XS |
| 6.3 | **Step 16** — the ⑨ warning, its own stamp, `purge_imminent` | M |
| 6.4 | **Step 17** — purge *all four sets*, keep every record forever | M |
| 6.5 | Resolve the "feedback is never swept" contradiction in code and comments | S |

**This is the only destructive change in the plan, and it fails safe.** If 6.1
ships before the `collected` stamp exists, nothing has a clock and nothing is
deleted. That's an outage of cleanup, not of data.

**6.3 is unlike anything else in the system.** Every other effect is derivable from
state — "delete what's due" needs no memory. "Warn them at day 23" is a one-off
that must fire exactly once, so it needs its own stamp as an idempotency guard, and
the cron grows from *delete what's due* to *notice what's approaching*.

⚠️ **Vercel Hobby permits one cron run a day**, so "23 days" means 23–24. Fine
here. It also means an hourly sweep isn't available without Pro — a constraint that
has already broken a deploy once.

---

## Phase 7 · The status capability

**The last piece of side-path C. Depends on nothing; deliberately last.**

| | Ships | Size |
| --- | --- | --- |
| 7.1 | A `status` purpose on the existing token, carried in the ② receipt | S |
| 7.2 | Email + a fresh PIN as the other way in | M |
| 7.3 | The status page requires one or the other | S |

**Why last:** Aaron's 2026-08-01 change already closed the security hole this was
protecting against — feedback no longer rides on an unverified email. What remains
is *convenience*, not exposure: a customer who lost the email having a second way
back in.

**Why it's cheap when it comes:** `signFeedbackToken` / `verifyFeedbackToken` are
already purpose-bound. 7.1 is a second purpose string and a second route, not a new
mechanism.

---

## 3 · The shape of it

```
Phase 0  take money  ──────────────────────────────► independent, blocks revenue
Phase 1  schema     ──┬──────────────────────────►
Phase 2  trust fixes  ┘  (parallel — no shared files)
                        │
Phase 3  visibility ────┤ needs 1
Phase 4  language   ────┤ needs 1.4
Phase 5  control    ────┤ needs 1
                        │
Phase 6  the ending ────┘ needs 3 (the collected stamp) and 5 (the handle)

Phase 7  status link ─────────────────────────────► independent, deliberately last
```

**Three genuine dependencies, everything else is judgement:** Phase 1 before 3/4/5;
Phase 3 before 6; Phase 5 before 6.

**The order optimises for:** a product that can be trusted with a live customer
(2), then an operator who can see his own workflow (3), then the feature that makes
Japanese coaches possible (4), then the controls (5) before the deletion (6).

**If time runs short, the honest cut is Phase 4.** The platform works in English
today. Nothing else on this list is optional in the same way — 2 fixes silent
failures, 3 fixes blindness, 5 and 6 are storage cost and a promise about deletion.

---

## 4 · What to settle before starting

All three settled on 2026-08-01:

1. ✅ **The naming collision** — `intake` / `response` everywhere. Phase 1.4 carries
   the rename.
2. ✅ **The token stays a year.**
3. ✅ **Backfill or cut over?** **Start empty** — there are no real customers, so
   there is no history worth reconstructing.

**All settled.** The red flags below record the reasoning, including the one answer
that changes when Phase 1 should land.

---

## 5 · Red flags — raised, and answered 2026-08-01

All four are settled. Kept in full because the reasoning is why the plan is shaped
the way it is, and the next person to ask "why this order?" deserves the argument
rather than the conclusion.

### ✅ 1 · Do the coaches read English? — **Mixed. Translation stays optional.**

This was the one that could have inverted the plan. It doesn't: **some coaches read
English, some don't, and translation is per-coach** — which is exactly the case
`coaches.languages` was built for, and exactly what the derivation at step 5 does.

So the plan order stands, and two things in it are now confirmed rather than assumed:

- **Steps 6–7 and 11–12 stay optional**, with whole numbers, and a submission whose
  coach reads English runs 5 → 8 and 10 → 13 untouched.
- **Deriving translation need is worth building**, not just convenient. With a mixed
  roster, "does this one need translating?" is a real question with a different
  answer each time — the case where remembering fails.

**Phase 4 remains the honest cut if time runs short**, but with a caveat that wasn't
there before: cutting it doesn't cost a feature, it costs *a subset of the coaching
roster*. Yuta can only assign English-reading coaches until it lands.

### ✅ 2 · Is there production data to preserve? — **No real customers yet.**

**This makes Phase 1 substantially cheaper, and it is the single most useful answer
of the four.** Everything the migration had to be careful about evaporates:

| Was a risk | Now |
| --- | --- |
| existing `in_review` rows mislabelled by the semantic change | no rows to mislabel |
| `kind` rename touching live files | test rows only — rename freely |
| `submission_events` backfill vs cut over | **start empty.** Nothing worth reconstructing |
| the paid-ness `Record` misjudging a real paid submission | compiler-checked *and* nothing real at stake |

Phase 1.4 drops back from **M to S** and 1.2 loses its open question entirely.

> ### ⏳ And it changes the sequencing advice
>
> **Phase 1 is nearly free right now and gets permanently more expensive the moment
> Phase 0 completes.** A sixteen-value enum migration against an empty table is a
> `DROP` and a `CREATE`; against live paid submissions it's a careful, reversible,
> data-preserving exercise with a rollback plan.
>
> They don't compete — **Phase 0 is mostly operations** (Stripe keys, DNS, coach
> photography) and **Phase 1 is code**, so they run in parallel. But the ordering
> that matters is: **land Phase 1's migration before the first real payment.** That
> window is open now and closes exactly once.

### ✅ 3 · Response retention — **Same window. Everything together.**

Confirmed as settled: no set outlives another, which stays coherent because the
clock cannot start until the customer has the files in hand.

Two safeguards were already in the plan and now carry more weight, because they're
the *only* protection against a parent losing what they bought:

- **6.2 — ⑥ states the retention window at delivery.** Not a nicety. It's the term
  of service that makes the deletion fair, and the wording should be explicit:
  *download and keep this; we delete it 30 days after you do.*
- **6.3 — the ⑨ warning at day 23**, which is the last chance to collect again.

⚠️ **Neither is optional now.** If Phase 6 ships the deletion without the copy and
the warning, the first customer to lose a review will be right to be annoyed.

### ✅ 4 · Sixteen statuses — **All sixteen, as settled.**

The cheaper four-status version is recorded here and deliberately not taken. Each
rung is a filter Yuta can pull up, and each exists because a submission can stall
there — which is the test that separates a status from decoration.

Combined with answer 2, the cost argument mostly dissolves: the expensive part of a
sixteen-value enum was always the migration, and there is nothing to migrate.

---

---

## Related

- [`domains/submission/_SubmissionDocumentation.md` §2](../../src/domains/submission/_SubmissionDocumentation.md) — the northstar path, the status ladder, the point of no return
- [`shared/email/_EmailDocumentation.md`](../../src/shared/email/_EmailDocumentation.md) — the nine messages and which exist
- [`domains/settings/_SettingsDocumentation.md`](../../src/domains/settings/_SettingsDocumentation.md) — the timer taxonomy
- [`_NomenclatureLaw.md`](../../_NomenclatureLaw.md) — the settled vocabulary and how it's spelled
- [OPERATIONS.md](../../OPERATIONS.md) — Phase 0 in detail
