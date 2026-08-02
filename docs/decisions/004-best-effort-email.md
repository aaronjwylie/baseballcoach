# 004 — Transactional email is best-effort and never fatal

**Status:** Accepted

## Problem

Webhook handlers send email. If a send fails, does the handler fail?

Saying yes is the reflex — surface the error, let the platform retry. But
Stripe and Mux retry on any non-2xx, and their retries replay the *whole*
handler. A Resend outage would mean: payment succeeds, row is created, email
fails, handler 500s, Stripe retries, row already exists (fine — [ADR
003](003-shared-idempotent-fulfillment.md)), email fails again, 500 again…
for as long as the outage lasts. A degraded email provider becomes a retry storm
against a payment that already succeeded.

## Decision

Every send is wrapped so that failures **log and return** rather than throw. If
`RESEND_API_KEY` is unset, sends are skipped with a warning and the flow
continues.

The customer-visible outcome of a webhook — the Airtable row, the status
transition — never depends on an email being delivered.

## Consequences

**Money and state are never at risk from a mail failure.** The row is written,
the status moves, the customer's paid-for thing exists. They just don't get told
by email — and `/status` still shows them the truth.

**Failures are quiet.** This is the real cost. A misconfigured Resend key means
nobody hears from us and nothing goes red. Mitigations: the `[email]` log lines
in Vercel, and the OPERATIONS.md end-to-end test explicitly checks that each
email arrives.

**Not suitable for anything transactional.** This is right for notifications and
would be wrong for, say, a magic-link login — there the email *is* the feature.
No such flow exists in v1 (email-as-identity, no accounts) and none is planned.

**The feedback-ready path needs its own guard.** It's driven by an Airtable
automation that can be re-fired manually, so best-effort sending alone wouldn't
prevent a duplicate. Hence the `Feedback Emailed` checkbox, ticked after send.

---

## Amended 2026-08-01 — two exceptions, in opposite directions

The rule holds as the default and now has two named exceptions. Both were found
by building; neither was anticipated here.

**`sendEmail` reports.** It returns a boolean and still never throws. "Best-effort"
was always about not failing a webhook or a portal action because a mail server
hiccuped — it was never meant to make delivery *unknowable*. Most callers rightly
ignore the result.

**① the verification code fails the flow when it can't be sent.** The line above
about magic-link login turned out to be prophetic: the 6-digit code is exactly
that shape. The customer is *blocked* on the message, so swallowing a failure
strands them on step 2 waiting for a code that was never sent, with nothing on
screen to suggest otherwise. Honest degradation everywhere else; a dead end here.

**⑨ the deletion warning is stamped even when the send fails** — the opposite
call, for the opposite reason. Retrying nightly would turn one missed email into
seven, and nobody is blocked on a warning.

**The test that separates them:** *is someone waiting on this message to
continue?* If yes, a failure must surface. If no, a failure must not repeat.

**A third instance now exists** — the operator password reset (2026-08-01) is
also a message its recipient is blocked on. Two is a pattern; three is a rule
waiting to be written down.

*(The Airtable note above is historical — that automation is gone. The
idempotency guard survives it as `feedbackEmailedAt`.)*
