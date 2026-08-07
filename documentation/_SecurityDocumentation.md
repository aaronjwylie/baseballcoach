# \_SecurityDocumentation — this project's threat model and boundaries

> **Scope:** this project only. Governed by [`_SecurityLaw.md`](../laws/_SecurityLaw.md), which holds
> the *rails*; this holds **what we are actually defending, where the boundaries run, and what is
> open.**
>
> **If this contradicts the code, the code wins — fix this doc, then fix the code.**

---

## 1 · The northstar

### 1a · The threat model

What this product is worth attacking for, in the order the value actually sits:

| Asset | Why it matters | Who wants it |
|---|---|---|
| **A child's video and name** | the single most sensitive thing here. Footage of a minor, with their first name and age | anyone; and the reputational cost of one leak exceeds the platform's revenue |
| **The coach's feedback** | what the customer paid for | a customer who would rather not pay |
| **Operator logins** | the admin's account reaches every submission | credential-stuffers, opportunistically |
| **Stripe** | money | automated card-testing |

**What is deliberately not an asset: a customer account.** Customers never authenticate
([CLAUDE.md §2](../CLAUDE.md)). There is no password to steal, no session to hijack, and no account
takeover surface on the customer side — because there is no account. That is a security property of
the product decision, not of any code.

**The realistic attacker is not targeted.** At ~10 users the threat is a bot sweeping for open
endpoints and a customer poking at URLs, not someone who wants *this* platform. The rails are sized for
that and say so.

### 1b · The trust boundaries

| Boundary | Who may cross | How it is enforced |
|---|---|---|
| **the operator portal** | `admin`, `coach`, `translator` | `requireSession` / `requireRole` in the page or action — the **secure** check, close to the data. `proxy.ts` is optimistic and never the sole defence |
| **a coach's own work** | only the assignee | `isAssignedTo(submissionId, operatorId, "feedback")` — one function, four call sites. Previously the same check written out four times |
| **the customer's files** | the customer, via a link | `/api/feedback/[id]` — public only once released, and **410 Gone** rather than 404 once swept, so the record can still say what was sent |
| **any operator file** | operators only | `/api/files/[id]` — session required |
| **the upload gate** | a customer with a proven email | the flow cookie **plus** `emailVerifiedAt` — [ADR 010](../docs/decisions/010-verification-gates-upload.md) |
| **payment truth** | Stripe alone | verified against Stripe, **never against our own row**. A stale or forged row cannot mint an upload |
| **inbound webhooks** | Stripe, Resend | signature over the **raw, unparsed body**. Resend also rejects timestamps older than five minutes, or a captured delivery could be replayed forever |
| **the nightly sweep** | the cron | `CRON_SECRET`. **Unset means the sweep refuses to run** — a destructive job with no guard must not run at all |

### 1c · Where the secrets are declared

**Two files, split by audience** — a client component must never import a module full of secrets:

| File | Holds | Reachable from the browser? |
|---|---|---|
| `shared/config/env.ts` | `DATABASE_URL`, `AUTH_SECRET`, Stripe secret + webhook secret, Blob token, Resend key, `CRON_SECRET`, Basic Auth pair | ❌ server only |
| `shared/config/publicEnv.ts` | `NEXT_PUBLIC_SITE_URL`, Stripe publishable key | ✅ by design |

**Nothing else reads configuration.** Two further files read `NODE_ENV` — the framework's own switch,
not a secret.

**Passwords stop at one file, in their own domain.** `account/api/credentialApi.ts` is the only file
in `src/` that reads or writes `credentialTable.passwordHash`, and the only one importing bcrypt.
Checkable:

```
grep -rn "passwordHash" src/
```

The forgot-password flow needs a slice of the hash to make its emailed link single-use; that happens
*behind* the boundary as `passwordFingerprint()`, and the caller gets a string it can only compare.

---

## 2 · The audit — 2026-08-06

Not a full audit. These are the findings this refactor surfaced, recorded permanently.

### 2.1 — The production database password was pasted into a working transcript · **CRITICAL** · 🔶 OPEN

The connection string for the production Supabase instance, including its password, was pasted into a
session in order to run a migration dry-run. It is not stored in any file in this repo, deliberately.

**It must be rotated before handover.** Tracked in [OPERATIONS.md §15](../OPERATIONS.md).

### 2.2 — Dead credentials for retired services remain in `.env.local` · **MEDIUM** · 🔶 OPEN

`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`,
`AIRTABLE_WEBHOOK_SECRET`. Both services were retired by the platform pivot. The keys are live and
grant access to accounts nobody is watching. **Revoke at the provider** — deleting the lines is not
revocation.

### 2.3 — The whole site sits behind HTTP Basic Auth · **LOW** · 🟢 ACCEPTED

`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` gate every page. It excludes `/api`, so webhooks and uploads
still work — which is correct and worth stating, because it means **the API surface is already public**
while the pages are not. Accepted while the build is unfinished; the gate is cleared at go-live.

### 2.4 — `listCoaches()` had no role filter · **LOW** · ✅ FIXED

An inner join on `operator_profile` was the filter, on the reasoning that only coaches have profiles.
True with two roles; false the moment a translator existed. Every translator would have appeared in the
coach assignment dropdown. Not a privilege escalation — both are operators — but it is the shape of
one. Fixed 2026-08-06; the role is now asked for explicitly.

---

## 3 · The method — how each finding was actually found

- **2.1 and 2.2** — reading the environment file and the session transcript, deliberately, rather than
  reasoning about them.
- **2.4** — *enumerating* what a query returns rather than reading what its comment claimed. The
  docblock said the join was the filter and was correct when written; the comment was a claim about the
  past.
- **Nothing here was found by a tool.** That is the finding underneath the findings.

---

## 4 · Made mechanical

| Rail | How it stopped depending on memory |
|---|---|
| the hash never leaves one file | one grep, stated in the file's own docblock |
| a table name never becomes a word | `check:names`, first step of `build` |
| a role question is never a comparison | exhaustive `Record<Role, …>` — a fourth role is a compile error |
| a ladder question is never a comparison | exhaustive `Record<SubmissionStatus, …>` × 4 |
| the sweep cannot run unguarded | `CRON_SECRET` unset ⇒ refuse |
| an unsigned webhook cannot write | secret unset ⇒ **503**, not "skip the check" |

**Still memory:** rotating a leaked credential, revoking a dead one, and clearing the Basic Auth gate.
All three are in [OPERATIONS.md](../OPERATIONS.md), which is a list someone has to read.

---

## 5 · History

- **2026-07-29** — the platform pivot retired Airtable, Make.com and Mux, removing three third-party
  integrations and their credentials from the runtime. The credentials themselves were not revoked
  (§2.2).
- **2026-08-01** — the open `POST /api/status` endpoint was removed. It returned a customer's
  submissions keyed on an email address, which is trivially guessable; gating the page while leaving
  the endpoint open would have been theatre.
- **2026-08-05** — operator identity renamed from `user`; the table had named the wrong population,
  since customers use the product constantly and never get a row.
- **2026-08-06** — passwords contained to one file; the credential functions taken **off** the domain
  barrel, where they had been published to the whole app on the strength of nobody having called them.
