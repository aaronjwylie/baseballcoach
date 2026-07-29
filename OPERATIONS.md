# OPERATIONS.md — Setup & Runbook

Everything that lives outside the codebase: third-party account setup, the
Airtable base, webhooks, DNS, go-live, and the client's day-to-day workflow.

**Nothing in this document requires writing code.** It is all dashboard
configuration. If a step here contradicts [CLAUDE.md](CLAUDE.md), this file wins
for *operational* detail (what to click, which URL, which secret) and CLAUDE.md
wins for *architectural* intent (what we're building and why).

> **This document describes the system as it exists today.** Several approved
> changes are in flight — see [Pending changes](#pending-changes) at the bottom
> before configuring a production base, or you may have to migrate it twice.

**The one rule that has bitten this project before:** every webhook URL is
derived from the site URL. If the domain changes, **re-point every webhook** or
the flow silently breaks — no errors, just submissions that never progress.

---

## Table of contents

1. [Ownership model](#1-ownership-model)
2. [Move the code](#2-move-the-code)
3. [Create the service accounts](#3-create-the-service-accounts)
4. [Build the Airtable base](#4-build-the-airtable-base)
   · [4b. Migrating an existing base](#4b-migrating-an-existing-base)
5. [Environment variables](#5-environment-variables)
6. [Configure the webhooks](#6-configure-the-webhooks)
7. [Domain & DNS](#7-domain--dns)
8. [Verify the email domain](#8-verify-the-email-domain)
9. [End-to-end test (test mode)](#9-end-to-end-test-test-mode)
10. [Flip to live](#10-flip-to-live)
11. [Decommission the dev setup](#11-decommission-the-dev-setup)
12. [Yuta's daily workflow](#12-yutas-daily-workflow)
13. [Endpoint reference](#13-endpoint-reference)
14. [Troubleshooting](#14-troubleshooting)
15. [Pending changes](#pending-changes)

---

## 1. Ownership model

The client owns **every** third-party account — Stripe, Mux, Airtable, Resend,
Vercel, and the domain. Payments and customer data go directly to them; we never
hold either. Set accounts up in the client's name from the start, because
migrating a Stripe account with live charges on it is painful.

| Service | Purpose | Rough cost at MVP volume |
| --- | --- | --- |
| Vercel | Hosts the app | Free tier |
| Stripe | Payments | Per-transaction only |
| Mux | Video upload, storage, streaming | Usage-based, a few $/mo |
| Airtable | Database + the client's admin UI | Free or ~$20/mo |
| Resend | Transactional email | Free tier (3k/mo) |
| GoDaddy | Domain registration | ~$20/yr |

Target is under ~$80 CAD/month all-in. See the [Make.com note](#make-com) — we
may not need it at all, which keeps us comfortably under.

---

## 2. Move the code

- [ ] **Transfer the GitHub repo** to the client's account/org (repo →
      **Settings → Transfer ownership**), *or* have them create their own repo
      and push the code there.
- [ ] Client **imports the repo into their own Vercel account**
      (Vercel → **Add New → Project → Import Git Repository**).
- [ ] Confirm Vercel is watching the `main` branch.
- [ ] **Commit author emails must match a GitHub account on the client's side**,
      or Vercel blocks the build. This has cost us a deploy cycle before.

---

## 3. Create the service accounts

- [ ] **Stripe** — account created, business and bank details completed so it
      can accept live charges. (Activation can take a day or two — start early.)
- [ ] **Mux** — account plus an access token (Settings → Access Tokens). You
      need both the token ID and secret; the secret is shown **once**.
- [ ] **Airtable** — account and a base (next section).
- [ ] **Resend** — account plus a **verified sending domain**. Without
      verification, emails are silently skipped rather than failing loudly.
      DNS propagation can take hours — **do this first**, not on launch day.

---

## 4. Build the Airtable base

The app reads and writes one table whose **field names are load-bearing** —
they appear as exact strings in the code. A rename in Airtable breaks the app
with no warning.

Create a table named `Submissions` (or set `AIRTABLE_TABLE_NAME` to match).

| Field | Type | Written by |
| --- | --- | --- |
| `Submission ID` | **Autonumber** — make this the primary field | Airtable |
| `Customer Email` | Single line text | App |
| `Player Name` | Single line text | App |
| `Player Age` | Number (integer, no decimals) | App |
| `Focus` | Single select — `Hitting`, `Pitching`, `Fielding`, `Catching`, `Other` | App |
| `Customer Notes` | Long text | App — **what the customer wrote; don't edit** |
| `Internal Notes` | Long text | App + you — system messages and your own |
| `Status` | Single select — see below | App, then you |
| `Submitted At` | **Created time** | Airtable |
| `Stripe Payment ID` | Single line text | App |
| `Stripe Amount` | Currency (CAD) | App |
| `Mux Upload ID` | Single line text | App |
| `Mux Asset ID` | Single line text | App (Mux webhook) |
| `Mux Playback ID` | Single line text | App (Mux webhook) |
| `Assigned Coach` | Single line text | **You** — the app only reads it |
| `Feedback Video URL` | URL | **You** — the coach's Loom/video link |
| `Feedback Emailed At` | Date (include time) | App (feedback webhook) |

`Status` options, in this order:

`Awaiting Upload` · `New` · `Assigned` · `In Review` · `Complete`

### Build it with the script, not by hand

The table's shape is declared in code, so don't click 17 fields against this
table and hope. From a checkout with `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID`
set (PAT scopes: `schema.bases:read/write` + `data.records:read/write`):

```bash
npm run schema -- --inspect          # what's there vs. what the app needs
npm run schema -- --create --apply   # empty base → builds 15 of the 17 fields
```

- [ ] Script run; it reports 15 fields created.

**Then add two fields by hand — Airtable's API cannot create computed types.**
`--inspect` lists them, and one of the two is load-bearing:

| Field | Type | |
| --- | --- | --- |
| `Submitted At` | Created time | **REQUIRED.** The status lookup sorts on it; without it `/api/status` returns 502 |
| `Submission ID` | Autonumber | Optional — a human-quotable reference. Nothing breaks without it |

Airtable → **+** at the right of the header row → pick the type.

- [ ] `Submitted At` added as **Created time**.
- [ ] `Submission ID` added as **Autonumber** (optional).
- [ ] `npm run schema -- --inspect` reports a clean match.

**The primary field is `Player Name`, not `Submission ID`** — an autonumber can't
be created through the API and so can't be primary at creation time. Player Name
is the better choice regardless: it's the frozen left column and what shows in a
linked-record chip. Nothing in the app depends on which field is primary.

### If you'd rather do it by hand

- [ ] Table and all fields created, names matching **exactly** (including case).
- [ ] `Submitted At` is a **created-time** field, not text.
- [ ] `Status` options created with those five exact labels, in that order.
- [ ] Create a **Personal Access Token** with scopes `data.records:read` and
      `data.records:write`, scoped to this base → `AIRTABLE_API_KEY`.
- [ ] Note the **Base ID** (`app…`) from the API docs → `AIRTABLE_BASE_ID`.

**Three things to know:**

- `Submitted At` and `Submission ID` are computed by Airtable. The app is
  blocked from writing them, so they can't be corrupted.
- `Customer Notes` holds what the parent typed, verbatim. System messages go to
  `Internal Notes` instead, so anything you forward to a coach is clean.
- `Assigned Coach` is plain text for now — type the coach's name. It becomes a
  link to a Coaches table if and when one is worth building.

### Suggested views

Worth setting up once; they're how the daily workflow in §12 is meant to be run.

| View | Filter | Purpose |
| --- | --- | --- |
| **Needs a coach** | `Status` is `New` | Your main queue |
| **In flight** | `Status` is `Assigned` or `In Review` | Waiting on a coach |
| **Stalled uploads** | `Status` is `Awaiting Upload` **and** `Submitted At` is before *1 day ago* | Paid but never uploaded — chase these |
| **Done** | `Status` is `Complete` | Archive |

---

## 4b. Migrating an existing base

**Only if a base already exists** with the old schema. Building fresh? Skip to
§5 — §4 above is already the target.

> **Deploy order matters.** The app breaks between the first rename and the
> deploy that matches it. Do this during a quiet window, and do the whole thing
> in one sitting. Renaming a column in Airtable **preserves its data** — the
> renames below are safe; only the two splits move data.

**1. Renames** (Airtable → double-click the column header → rename):

| From | To |
| --- | --- |
| `Email` | `Customer Email` |
| `Sport` | `Focus` |
| `Stripe Session ID` | `Stripe Payment ID` |
| `Feedback Link` | `Feedback Video URL` |
| `Notes` | `Customer Notes` |

**2. Type changes:**

- [ ] `Player Age` → Number, integer, no decimals. Airtable coerces existing
      text; check for any row that doesn't convert cleanly.
- [ ] `Focus` → Single select, options `Hitting`, `Pitching`, `Fielding`,
      `Catching`, `Other`. Airtable offers to create options from existing
      values — take it, then delete any stragglers.
- [ ] `Status` → add `New` and `Assigned` to the existing options. Order them
      `Awaiting Upload`, `New`, `Assigned`, `In Review`, `Complete`.

**3. New columns:**

- [ ] `Submission ID` — autonumber. Set it as the **primary field**.
- [ ] `Internal Notes` — long text.
- [ ] `Stripe Amount` — currency, CAD.
- [ ] `Assigned Coach` — single line text.
- [ ] `Submitted At` — **created time**. Note this reflects when the *row* was
      created, which for existing rows is when the app wrote it — close enough
      to the old `Created At` for ordering.
- [ ] `Feedback Emailed At` — date, with time.

**4. Data moves:**

- [ ] Any `Customer Notes` cell containing `[system]` lines: cut those lines
      into `Internal Notes`. Usually a handful of rows, if any.
- [ ] Rows where the old `Feedback Emailed` checkbox was ticked: put any
      plausible past timestamp in `Feedback Emailed At`. The value only needs to
      be non-empty — it's read as "already sent."
- [ ] Delete the old `Created At` and `Feedback Emailed` columns **last**, once
      everything else is verified.

**5. Status backfill:**

- [ ] Existing rows on `In Review` that have a video but no coach working on
      them yet should move to `New`. If you can't tell, leave them — `In Review`
      is still a valid status and nothing breaks.

**6. Deploy and verify:**

- [ ] Merge and deploy the matching code, then redeploy.
- [ ] Run the [§9 end-to-end test](#9-end-to-end-test-test-mode).
- [ ] Check `/status` with an email from a pre-existing row — this is what
      catches a missed rename, because the lookup reads nearly every column.

---

## 5. Environment variables

Set in **Vercel → Settings → Environment Variables**, for **Production** (and
Preview, with test-mode keys, if you want branch previews to work).

| Variable | Value / source | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Live URL, **no trailing slash** (e.g. `https://diamondpath.com`) | Yes |
| `STRIPE_SECRET_KEY` | Stripe live key `sk_live_…` | Yes |
| `STRIPE_WEBHOOK_SECRET` | From the Stripe webhook in step 6 (`whsec_…`) | Yes |
| `STRIPE_PRICE_ID` | A pre-created Stripe Price. Leave unset to price inline from `src/shared/config/site.ts` | No |
| `MUX_TOKEN_ID` | Mux access token ID | Yes |
| `MUX_TOKEN_SECRET` | Mux access token secret | Yes |
| `MUX_WEBHOOK_SECRET` | From the Mux webhook in step 6 | Yes |
| `AIRTABLE_API_KEY` | Airtable PAT (`pat…`) | Yes |
| `AIRTABLE_BASE_ID` | Base ID (`app…`) | Yes |
| `AIRTABLE_TABLE_NAME` | Defaults to `Submissions` | No |
| `AIRTABLE_WEBHOOK_SECRET` | Random secret — `openssl rand -hex 32`. Also used in step 6 | Yes |
| `RESEND_API_KEY` | Resend key. **If unset, emails are skipped silently** | No |
| `EMAIL_FROM` | Verified sender, e.g. `Diamond Path <hello@theirdomain.com>` | No |

- [ ] All required vars set for **Production**.
- [ ] Update the customer-facing content in
      [src/shared/config/site.ts](src/shared/config/site.ts) — business name, price, coach bios,
      contact email. This is the only file that needs editing for content.
- [ ] **Redeploy.** Env changes only take effect on a new build.

Env vars are read in exactly one place — [src/shared/config/env.ts](src/shared/config/env.ts).
Required values throw at point of use with a message naming the variable, so a
misconfiguration surfaces as a clear error rather than a silent failure.

---

## 6. Configure the webhooks

**Do this after the domain is final** (step 7), so the URLs don't need redoing.

### Stripe

- [ ] Stripe → Developers → Webhooks → **Add endpoint**
- [ ] URL: `https://<site>/api/webhooks/stripe`
- [ ] Event: `checkout.session.completed`
- [ ] Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

> Test mode and live mode have **separate** webhook endpoints and **separate**
> signing secrets. A test-mode secret in production fails every signature check.

### Mux

- [ ] Mux → Settings → Webhooks → add `https://<site>/api/webhooks/mux`
- [ ] Events: `video.asset.ready`, `video.asset.errored`
- [ ] Copy the signing secret → `MUX_WEBHOOK_SECRET`

### Airtable — the feedback-ready automation

This is what emails the customer when their feedback is done.

- [ ] Airtable base → **Automations** → create new
- [ ] **Trigger:** *When a record matches conditions* → `Status` is `Complete`
      **and** `Feedback Link` is not empty
- [ ] **Action:** *Send request*
      - Method: `POST`
      - URL: `https://<site>/api/webhooks/airtable`
      - Header: `x-webhook-secret` → the `AIRTABLE_WEBHOOK_SECRET` value
      - Body (JSON): `{ "recordId": "<record ID from the trigger step>" }`
- [ ] Turn the automation **on**
- [ ] Redeploy so all three secrets are live

The endpoint authenticates with a constant-time comparison of that shared
secret, re-reads the record rather than trusting the payload, and ticks
`Feedback Emailed` so a re-fired automation can't double-send.

<a id="make-com"></a>
### A note on Make.com

CLAUDE.md §7 budgets for Make.com as the automation glue. **In practice we
haven't needed it.** The feedback-ready email — its main job — is handled by the
Airtable automation above, calling our own endpoint. The two remaining candidate
scenarios (abandoned-upload reminder, admin daily digest) can both be built as
native Airtable automations too.

Recommend we **drop Make.com from the stack** unless something specific needs
it: one fewer vendor, one fewer subscription, one fewer place to look when
something breaks. Flagged for Ben.

---

## 7. Domain & DNS

- [ ] Add the custom domain in **Vercel → Settings → Domains**
- [ ] In **GoDaddy**, point DNS at the A/CNAME records Vercel provides.
      GoDaddy is the *registrar only* — it does not host the app.
- [ ] Wait for verification to go green in Vercel
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the final domain **exactly**, then redeploy
- [ ] **Re-check all three webhook URLs** from step 6 against the final domain

---

## 8. Verify the email domain

- [ ] Resend → Domains → add the client's domain
- [ ] Add the DKIM/SPF records Resend gives you to GoDaddy DNS
- [ ] Wait for Resend to show **Verified** (minutes to hours)
- [ ] Set `EMAIL_FROM` to an address on that domain, then redeploy

Until this is done, either emails don't send or they land in spam. If
`RESEND_API_KEY` is unset the app logs a warning and carries on — the flow
still works, the customer just never hears from us.

> **Observed 2026-07-29, on the dev account:** with a key set but no verified
> domain, Resend rejects every send with
> `403 validation_error — "You can only send testing emails to your own email
> address (yuta@mini-engine.com)."` Mail reaches the account owner and nobody
> else, and the app logs it and carries on. **This is the single most
> launch-blocking item outside the Airtable migration**, because it fails
> quietly: the flow looks healthy and the customer simply hears nothing.

---

## 9. End-to-end test (test mode)

Run the whole thing on **Stripe test keys** before going live.

- [ ] From `/start`, complete checkout with test card `4242 4242 4242 4242`
      (any future expiry, any CVC)
- [ ] Redirect lands on `/upload?session_id=…` **on the live domain**
- [ ] An Airtable row appears, `Status = Awaiting Upload`
- [ ] "Payment received" email arrives
- [ ] Upload a short video; row flips to `In Review`; `Mux Asset ID` and
      `Mux Playback ID` populate
- [ ] "Video received" email arrives
- [ ] In Airtable, paste a `Feedback Link` and set `Status = Complete`
- [ ] "Feedback ready" email arrives with a working link
- [ ] `Feedback Emailed` checkbox ticks itself
- [ ] On `/status`, entering the same email shows the submission and a working
      **Watch feedback** button
- [ ] Repeat the upload step **on a real phone** — mobile upload is the
      highest-risk part of the flow

---

## 10. Flip to live

- [ ] Swap `STRIPE_SECRET_KEY` to the live `sk_live_…` key
- [ ] **Recreate the Stripe webhook in live mode** (test and live are separate)
      and update `STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy
- [ ] One **real low-stakes purchase**, end to end, then refund it in Stripe
- [ ] Confirm the money lands in the client's Stripe balance
- [ ] Confirm the refund goes through cleanly

---

## 11. Decommission the dev setup

Once the client's site is live and verified, tear down the old dev deployment so
nothing keeps firing against test data or duplicating work.

- [ ] Delete (or pause) the **dev Vercel project** so its deployment and any
      `*.vercel.app` URL stop serving
- [ ] Disable/delete the **dev Stripe webhook** (test mode) so it no longer fires
- [ ] Disable/delete the **dev Mux webhook**
- [ ] Turn off the **dev Airtable automation**, and archive the dev base if it
      held only test rows
- [ ] Revoke any **dev-only API keys and tokens** no longer in use
- [ ] Re-run the [step 9 test](#9-end-to-end-test-test-mode) against production
      after teardown — confirming nothing live depended on a dev resource

---

## 12. Yuta's daily workflow

The whole operation runs from Airtable. Budget ~10–15 minutes per submission.

The app sets the first two statuses. **The middle three are yours** — they're
how you tell at a glance what's waiting on you versus waiting on a coach.

| Status | Means | Who moves it |
| --- | --- | --- |
| `Awaiting Upload` | Paid, no video yet | App |
| `New` | Video's in, **needs a coach** | App |
| `Assigned` | Coach has it, hasn't started | You |
| `In Review` | Coach is working on it | You |
| `Complete` | Feedback delivered | You — **this sends the email** |

**Once or twice a day, open the "Needs a coach" view:**

1. **Pick a coach** based on the `Focus` field and read `Customer Notes` for
   anything the parent asked for specifically.
2. **Email the coach** the video: `https://stream.mux.com/<Mux Playback ID>.m3u8`,
   or open the asset in the Mux dashboard. Include the player's name, age, and
   the customer's notes.
3. **Type the coach's name into `Assigned Coach`** and set `Status` to
   `Assigned`. The row leaves your queue.
4. **When the coach starts**, set `Status` to `In Review`. Optional — it only
   exists so you can tell a slow coach from one who hasn't begun.
5. **When their feedback video arrives** (usually a Loom), paste the link into
   `Feedback Video URL`.
6. **Set `Status` to `Complete`.**

That last step is the trigger. The automation fires, the customer gets their
"feedback ready" email, and `Feedback Emailed At` stamps itself. Nothing else
to do.

**Things to watch for:**

- The **Stalled uploads** view → customers who paid and never uploaded. Their
  confirmation email has the upload link; resend it or reach out.
- A `[system]` line in `Internal Notes` → Mux failed to process the video. The
  status goes back to `Awaiting Upload`; ask the customer to re-upload.
- Setting `Complete` **without** a `Feedback Video URL` sends nothing. That's
  deliberate — an email with no link would be worse than none. Fill the URL in,
  and the automation fires on the next check.

**Safe to edit:** `Status`, `Assigned Coach`, `Feedback Video URL`,
`Internal Notes`.

**Don't edit:** any `Stripe` or `Mux` ID — the app uses those to find rows —
or `Customer Notes`, which is the customer's own words and should stay as they
wrote them. `Submission ID` and `Submitted At` are computed by Airtable and
can't be edited anyway.

---

## 13. Endpoint reference

| Route | Trigger | What it does |
| --- | --- | --- |
| `POST /api/checkout` | `/start` form submit | Creates the Stripe Checkout session, returns its URL |
| `POST /api/webhooks/stripe` | Stripe, on `checkout.session.completed` | Creates the Airtable row (`Awaiting Upload`) + payment email |
| `POST /api/mux/upload` | `/upload` page load | Verifies the session is paid, issues a Mux direct-upload URL |
| `POST /api/webhooks/mux` | Mux, on `video.asset.ready` | Stores asset + playback IDs, → `New`, video-received email |
| `POST /api/webhooks/airtable` | Airtable automation, on `Complete` | Feedback-ready email, ticks `Feedback Emailed` |
| `POST /api/status` | `/status` form submit | Email-keyed lookup of the customer's own submissions |

All three webhook endpoints verify authenticity before doing any work —
Stripe and Mux by SDK signature check, Airtable by shared secret. All are
idempotent: a retried delivery is a no-op, never a duplicate row or a second
email.

---

## 14. Troubleshooting

**Payment succeeds but no Airtable row appears.**
Check Stripe → Webhooks → the endpoint's recent deliveries. A 400 means the
signing secret is wrong (test secret in production is the usual cause). A 500
means Airtable rejected the write — check the Vercel function logs, then that
the field names match section 4 exactly.

**Video uploads but the row never leaves `Awaiting Upload`.**
The Mux webhook isn't landing. Check Mux → Settings → Webhooks for delivery
failures, and confirm the URL matches the current domain.

**Customer says they got no email.**
Emails are best-effort by design — a Resend failure logs but never breaks the
flow, so the submission still went through. Check the Vercel logs for `[email]`
lines, then that `RESEND_API_KEY` is set and the domain is verified.

**Feedback-ready email didn't fire.**
The automation only triggers when `Status = Complete` **and** `Feedback Link`
is non-empty. If `Feedback Emailed` is already ticked it deliberately won't
re-send. Check the automation's run history in Airtable.

**Everything broke at once, right after a domain change.**
Every webhook URL. See the warning at the top of this document.

---

## Pending changes

Approved but not yet implemented. **Read this before building a production
base** — three of these change the Airtable schema, and doing them before real
customer data lands is far cheaper than after.

| Change | Impact on this document | Status |
| --- | --- | --- |
| **Naming sweep** + **5 statuses** | §4 and §4b above — the schema here is already the target | **Done in code, base migration pending** |
| **Stripe Elements** replaces hosted Checkout | The Stripe webhook event becomes `payment_intent.succeeded`; a new `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` var; `/start` → `/submit`. **No further schema change** — `Stripe Payment ID` already holds the right thing under the right name | Approved, not started |
| ~~Rate limit on `/api/status`~~ | None operationally | **Done** (Step 3) — 5/IP/min, in-memory so partial; shared state (Upstash) is a scope decision |
| **Verify the Resend domain** | §8 | **Not done — blocks launch.** Mail currently reaches only the account owner |
| **Set `EMAIL_FROM`** | §5 | Not done — sends fall back to Resend's onboarding sender |
| **Drop Make.com** | Section 7 of CLAUDE.md becomes moot; the two remaining scenarios become Airtable automations | Recommended, awaiting Ben |
| **Coaches table** | `Assigned Coach` becomes a linked record instead of text | Deferred until it earns its place |

---

_Companion to [CLAUDE.md](CLAUDE.md) (architecture and intent) and
[README.md](README.md) (developer quick start)._
