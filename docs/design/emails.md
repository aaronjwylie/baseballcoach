# Transactional email — who gets told what

**Status: partly built.** This is the agreed target (Yuta, 2026-07-30), pinned
here so the gaps are visible rather than remembered. **Four of the six exist**;
two of the missing three need a workflow change, not just a template.

Every send is **best-effort** — a failure logs and never throws into a webhook or
a portal action ([ADR 004](../decisions/004-best-effort-email.md)). The one
exception in spirit is the verification code: it can't fail silently and leave a
usable product, because the customer is blocked on it.

---

## The six messages

| # | Trigger | To | Status |
|---|---|---|---|
| 1 | Email verification code | customer | ✅ **built** — `domains/verification/api/verificationEmail.ts` |
| 2 | Payment succeeded, submission accepted | customer **+ Yuta** | 🔶 **half** — the customer receipt is built; Yuta is not told |
| 3 | Coach assigned to a submission | coach | ✅ **built** — `domains/coach/api/coachEmail.ts`, carries the customer details and a per-file download link |
| 4 | Coach uploaded their response | Yuta **+ coach** | ❌ **not built** — and today this step emails the *customer* instead |
| 5 | Yuta approved the response → released | customer | ❌ **not built** — **needs an approval gate that doesn't exist** |
| 6 | Yuta marks the submission resolved | customer + coach | ❌ **not built** — trigger decided, see below |

Target lifecycle once the gate exists (additions in bold):

`draft → awaiting_payment → new → assigned → in_review → `**`awaiting_approval`**` → complete`,
plus a **`resolvedAt`** timestamp for #6.

---

## What #4 and #5 actually change

They are not two templates. Together they insert **an approval step into the
coach workflow.**

**Today:** the coach uploads their feedback file → `storeFeedbackAndComplete`
sets `status: "complete"`, stamps `completedAt`, and emails **the customer**
immediately. Yuta never sees it.

**Target:** the coach uploads → Yuta is told → Yuta reviews and approves → *then*
the customer is told.

That requires:

1. **A new status** between `in_review` and `complete` — `awaiting_approval`.
   A Postgres enum change, so a migration (CLAUDE.md §14: stop and flag).
2. **Coach upload stops completing the submission.** It sets `awaiting_approval`
   and emails Yuta + the coach. `completedAt` must **not** be stamped here — it
   starts the retention clock, and the files are still needed for review.
3. **An admin approve action** — a button in `/admin` that sets `complete`,
   stamps `completedAt`, and sends message #5 to the customer.
4. ~~**Message #3 on assignment**~~ — done; `assignCoachAction` sends it.

Until (2) exists, `feedbackEmailedAt` and the customer email fire from the wrong
place. Note the ordering trap: `completedAt` is what the retention sweep counts
from ([ADR 012](../decisions/012-retention-and-operator-settings.md)), so
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
