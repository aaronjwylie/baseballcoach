# email — `src/shared/email/`

The **email seam** — transport plus the brand shell — and the matrix of who gets
told what.

The transport is domain-less: `sendEmail()` and `emailShell()` know how to send
and how a message should look, and nothing about what any particular message
means. Each message itself lives in the domain that owns its event, as
`api/xEmail.ts`. This doc is where the whole set is accounted for, because "which
emails exist and which don't" is a question no single domain can answer.

---

## Where we are now — 2026-07-30

Four of six built. The transport is stable and the approval gate has landed, so
the remaining three are templates plus one small decision each. Detail below.

---

## Who gets told what

**Status: partly built.** This is the agreed target (Yuta, 2026-07-30), pinned
here so the gaps are visible rather than remembered. **Four of the six exist.**

The approval gate this doc used to call "not built" now *is* built — a coach's
upload moves the submission to `awaiting_approval`, and `approveAndComplete`
releases it. So what's left is templates, not workflow: tell Yuta when a payment
lands (#2's other half), tell Yuta and the coach when a response is submitted
(#4), and the resolved follow-up (#6).

Every send is **best-effort** — a failure logs and never throws into a webhook or
a portal action ([ADR 004](../../../docs/decisions/004-best-effort-email.md)). The one
exception in spirit is the verification code: it can't fail silently and leave a
usable product, because the customer is blocked on it.

---

## The six messages

| # | Trigger | To | Status |
|---|---|---|---|
| 1 | Email verification code | customer | ✅ **built** — `domains/verification/api/verificationEmail.ts` |
| 2 | Payment succeeded, submission accepted | customer **+ Yuta** | 🔶 **half** — the customer receipt is built; Yuta is not told |
| 3 | Coach assigned to a submission | coach | ✅ **built** — `domains/coach/api/coachEmail.ts`, carries the customer details and a per-file download link |
| 4 | Coach uploaded their response | Yuta **+ coach** | ❌ **not built** — the status moves to `awaiting_approval`, but nobody is told, so Yuta has to notice |
| 5 | Yuta approved the response → released | customer | ✅ **built** — `approveAndComplete` → `feedback/api/feedbackEmail.ts` |
| 6 | Yuta marks the submission resolved | customer + coach | ❌ **not built** — trigger decided, see below |

Lifecycle as built:

`draft → awaiting_payment → new → assigned → in_review → awaiting_approval → complete`

Still to add for #6: a **`resolvedAt`** timestamp (not a status — see below).

---

## The approval gate — built 2026-07-30

*Kept because the reasoning still explains the shape of the workflow.*

These were never two templates. Together they inserted **an approval step into
the coach workflow**, which is now in place:

**Before:** the coach uploaded their feedback file and it went straight to the
customer. Yuta never saw it.

**Now:** the coach uploads → the submission sits at `awaiting_approval` → Yuta
approves → the customer is told. The one piece still missing is *telling* Yuta
it's waiting (#4); today he has to spot it in the queue.

What it took:

1. ✅ **A new status** between `in_review` and `complete` — `awaiting_approval`.
2. ✅ **Coach upload stops completing the submission.** It sets
   `awaiting_approval` and correctly does *not* stamp `completedAt` — that starts
   the retention clock, and the files are still needed for review.
3. ✅ **An admin approve action** — `approveAndComplete` sets `complete`, stamps
   `completedAt`, and sends message #5.
4. ✅ **Message #3 on assignment** — `assignCoachAction` sends it.
5. ❌ **Message #4** — nobody tells Yuta the response is waiting.

Until (2) exists, `feedbackEmailedAt` and the customer email fire from the wrong
place. Note the ordering trap: `completedAt` is what the retention sweep counts
from ([ADR 012](../../../docs/decisions/012-retention-and-operator-settings.md)), so
whichever action ends up owning "complete" **must** stamp it. That exact omission
was a live bug on 2026-07-30 — the status was set without the timestamp, and
completed submissions were never swept.

---

## Decided 2026-07-30 (Yuta + Ben)

**#6 fires when Yuta marks the submission resolved** — a portal action, not a
timer and not a customer confirmation. It keeps the judgement with the person who
can actually make it, at the cost of one more thing to remember.

Recommendation when it's built: **`resolvedAt` as a timestamp, not a status.**
The lifecycle is already six states and the queue doesn't need a seventh —
"resolved" is an event on a finished submission, not a distinct kind of work.
`completedAt` / `paidAt` set the precedent.

⚠️ **It collides with retention.** Files are swept 24h after `completedAt`, so by
the time Yuta resolves a submission the uploads are usually gone. The resolved
email must not promise access to them, and the portal should say plainly that
it's resolving a submission whose files have been deleted.

**"Yuta" resolves to the `admin` user's own email**, read from the `users` row —
one home for the fact, and it survives a change of operator with no redeploy.
`site.email` (`contact@baseball-sensei.com`) stays the *public* contact address,
and `EMAIL_FROM` is who mail is sent *as*. Three jobs, three homes; collapsing
them would mean a change of operator silently changing the public address.

If notifications should ever go to a shared inbox instead of a person, that's the
moment to revisit — not before.

**The approval gate is pinned, not scheduled.** Until it's built, the coach's
upload continues to complete the submission and email the customer directly.

---

## Where a send belongs

The domain that owns the *event* owns the send — not a central mailer:

- `verification/` → the code
- `payment/` → the receipt (and Yuta's copy of it)
- `coach/` → assignment
- `feedback/` → coach-submitted, approved-and-released, resolved

`shared/email` stays transport plus the shell: `sendEmail()` and
`emailShell()`, and nothing about what any particular message means.

**Escape customer-supplied values.** Filenames and player names land in HTML;
`paymentEmail.ts` has the helper and any new template needs the same treatment.
