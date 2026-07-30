# OPERATIONS.md — Setup & Runbook

Everything outside the codebase: local development, provisioning the client's
accounts, deploying to Vercel, and the operator's day-to-day workflow.

If a step here contradicts [CLAUDE.md](CLAUDE.md), this file wins for
*operational* detail (what to click, which URL, which secret) and CLAUDE.md wins
for *architectural* intent.

**The one rule that has bitten this project before:** every webhook URL is
derived from the site URL. If the domain changes, **re-point the Stripe webhook**
or payments succeed with no submission row appearing — a silent failure.

---

## Production status (2026-07-30)

**Live at `baseball-sensei.vercel.app`** (deploys from `main`).

| Piece | State |
| --- | --- |
| Hosting | Vercel — auto-deploys `main` |
| Database | **Supabase** Postgres — schema migrated; admin `yuta@example.com` seeded; ~8 demo submissions + 2 demo coaches seeded |
| Storage | **Vercel Blob** (`BLOB_READ_WRITE_TOKEN` set) |
| Auth | `AUTH_SECRET` set; login working |
| Email | **Resend**, domain `baseball-sensei.com` verified + sending (§8); receiving via Google Workspace `contact@` |
| **Stripe** | **Not set up yet** — keys + webhook pending (§5–§6). Until then the funnel can't take payments or record submissions. |

Every env-var change needs a **redeploy** to take effect — this has bitten us
repeatedly (AUTH_SECRET, EMAIL_FROM).

---

## Table of contents

1. [Ownership model](#1-ownership-model)
2. [Local development](#2-local-development)
3. [Create the production accounts](#3-create-the-production-accounts)
4. [Deploy to Vercel](#4-deploy-to-vercel)
5. [Environment variables](#5-environment-variables)
6. [The Stripe webhook](#6-the-stripe-webhook)
7. [Domain & DNS](#7-domain--dns)
8. [Verify the email domain](#8-verify-the-email-domain)
9. [End-to-end test (test mode)](#9-end-to-end-test-test-mode)
10. [Flip to live](#10-flip-to-live)
11. [Decommission the dev setup](#11-decommission-the-dev-setup)
12. [The operator workflow](#12-the-operator-workflow)
13. [Endpoint reference](#13-endpoint-reference)
14. [Troubleshooting](#14-troubleshooting)
15. [Pending changes](#15-pending-changes)

---

## 1. Ownership model

The client owns **every** account. Payments and customer data go directly to
them; we never hold either. Set accounts up in the client's name from the start.

| Service | Purpose | Rough cost at MVP volume |
| --- | --- | --- |
| Vercel | Hosts the app | Free tier |
| Supabase | Postgres (system of record) | Free tier |
| Vercel Blob | Video + feedback file storage | Storage + transfer, a few $/mo |
| Stripe | Payments | Per-transaction only |
| Resend | Transactional email | Free tier (3k/mo) |
| Domain registrar | The domain | ~$20/yr |

Target is under ~$80 CAD/month all-in.

---

## 2. Local development

No cloud accounts are needed to develop — Postgres runs in Docker and files are
saved to local disk. You only need **Stripe test keys** to exercise payment.

```bash
docker compose up -d db            # Postgres 16 on localhost:5434
cp .env.example .env.local         # fill Stripe test keys + AUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:migrate                 # apply the schema
npm run db:seed                    # first admin (+ samples, since SEED_SAMPLES=1 in dev)
npm run dev                        # http://localhost:3000
```

Sign in at `/login` as **`yuta@example.com` / `changeme123`** → `/admin`.

- `DATABASE_URL` in `.env.example` already points at the docker db.
- `STORAGE_DIR` defaults to `./.storage` (gitignored).
- Forward Stripe webhooks locally with
  `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

---

## 3. Create the production accounts

- [ ] **Supabase** — a project (this is the Postgres database). Note the
      connection strings under Project → Settings → Database.
- [ ] **Vercel Blob** — a Blob store in the Vercel project (Storage → Blob).
- [ ] **Stripe** — account with business/bank details completed so it can accept
      live charges. Activation can take a day or two — start early.
- [ ] **Resend** — account plus a **verified sending domain** (DNS can take
      hours — do this first, not on launch day).

---

## 4. Deploy to Vercel

- [ ] **Import the repo** into the client's Vercel account (Add New → Project).
      Commit author emails must match a GitHub account, or Vercel blocks the
      build.
- [ ] **Add the Supabase integration** (Vercel → Storage, or the Supabase
      Marketplace connector). It writes `POSTGRES_URL` (pooled) and
      `POSTGRES_URL_NON_POOLING` (direct) into the project. Our code reads
      `DATABASE_URL || POSTGRES_URL`, so no aliasing is needed.
      - **Development environment: leave unchecked** — local dev uses Docker.
      - **Custom prefix: leave blank** so the names are `POSTGRES_URL` etc.
- [ ] **Add the Blob store** → it sets `BLOB_READ_WRITE_TOKEN`. With a token
      present, the app uses Blob; without it, local disk.
- [ ] **Set the remaining env vars** (next section), for **Production**.
- [ ] **Run the migrations against prod** — from a checkout, pointing at the
      *direct* (non-pooling) URL:
      ```bash
      POSTGRES_URL_NON_POOLING="<supabase direct url>" npm run db:migrate
      ```
- [ ] **Seed the first admin** (no samples in prod):
      ```bash
      POSTGRES_URL_NON_POOLING="<direct url>" \
      SEED_ADMIN_EMAIL="yuta@theirdomain.com" SEED_ADMIN_PASSWORD="<strong>" \
      npm run db:seed
      ```
- [ ] **Redeploy** so the env vars take effect.

---

## 5. Environment variables

Set in **Vercel → Settings → Environment Variables**, for **Production** (and
Preview with test-mode keys if you want branch previews).

| Variable | Value / source | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Live URL, no trailing slash (e.g. `https://baseballsensei.com`) | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe `pk_live_…` — browser-visible by design | Yes |
| `STRIPE_SECRET_KEY` | Stripe live `sk_live_…` | Yes |
| `STRIPE_WEBHOOK_SECRET` | From the Stripe webhook in step 6 (`whsec_…`) | Yes |
| `STRIPE_PRICE_ID` | Optional — else priced inline from `src/shared/config/site.ts` | No |
| `AUTH_SECRET` | Session secret — `openssl rand -base64 32` | Yes |
| `POSTGRES_URL` | Supabase pooled URL (set by the integration) | Yes* |
| `DATABASE_URL` | Only if not using the Supabase integration | Yes* |
| `BLOB_READ_WRITE_TOKEN` | Set by the Blob store | Yes |
| `RESEND_API_KEY` | Resend key. **Unset = emails skipped, logged** | No |
| `EMAIL_FROM` | Verified sender, e.g. `Baseball Sensei <hello@theirdomain.com>` | No |

\* Provide one of `POSTGRES_URL` / `DATABASE_URL`. **Do not** set
`SEED_SAMPLES` in production.

Env vars are read in exactly one place — `src/shared/config/env.ts` (server) and
`publicEnv.ts` (browser). Required values throw at point of use naming the
variable.

---

## 6. The Stripe webhook

Do this **after** the domain is final.

- [ ] Stripe → Developers → Webhooks → **Add endpoint**
      `https://<site>/api/webhooks/stripe`
- [ ] Event: **`payment_intent.succeeded`** (and `payment_intent.payment_failed`
      for visibility)
- [ ] Copy the signing secret → `STRIPE_WEBHOOK_SECRET`, then redeploy

> Test mode and live mode have **separate** endpoints and **separate** signing
> secrets. A test secret in production fails every signature check — payments
> succeed and no submission row appears.

---

## 7. Domain & DNS

- [ ] Add the custom domain in **Vercel → Settings → Domains**
- [ ] Point the registrar's DNS at the records Vercel provides
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the final domain **exactly**, then redeploy
- [ ] Re-point the Stripe webhook (step 6) at the final domain

---

## 8. Email — Resend (✅ done)

**`baseball-sensei.com` is verified in Resend and sending is live** (2026-07-30).
A real "feedback ready" email was delivered to a Gmail inbox.

Current setup:

| Piece | Value |
| --- | --- |
| Verified domain | `baseball-sensei.com` (Resend, region **us-east-1**) |
| DNS records | DKIM `TXT` `resend._domainkey`; SPF `MX` + `TXT` on the **`send.`** subdomain — added in **GoDaddy** (auto-configured) |
| Send from | `EMAIL_FROM = "Baseball Sensei <contact@baseball-sensei.com>"` (set in Vercel → redeploy) |
| API key | `RESEND_API_KEY` (set in Vercel) |
| **Receiving** | **Google Workspace** on `contact@baseball-sensei.com` (root MX) — replies to transactional email land in Yuta's inbox |

**Why Google + Resend coexist:** Resend's records live on the `send.` subdomain
and `resend._domainkey`; Google's MX/SPF live on the **root** and
`google._domainkey`. Different hosts → no conflict. Sending (Resend) and receiving
(Google) are independent.

**How the app sends email** (for adding new ones — e.g. a signup verification
mail): everything goes through `shared/email` — `sendEmail({ to, subject, html })`
(best-effort; the `from` is `EMAIL_FROM`, never per-send) + `emailShell(heading,
body, cta?)` for the brand wrapper. Each message is one `domains/<slice>/api/
xEmail.ts` file. Full pattern + a copy-paste example: **[CLAUDE.md §7 → Resend](CLAUDE.md#7-third-party-tool-integrations)**.

**To move it to a different domain/client:** repeat in that Resend account (add
domain → add the DNS records → verify → set `EMAIL_FROM` on the domain →
redeploy). Sends skip-and-log if `RESEND_API_KEY` is unset, and land only in the
account owner's inbox until a domain is verified.

---

## 9. End-to-end test (test mode)

Run the whole thing on **Stripe test keys** before going live.

- [ ] From `/start`, fill in the details, pay with test card `4242 4242 4242 4242`
- [ ] The card field is **on our page** (no redirect); land on
      `/upload?payment_intent=…`
- [ ] Upload a short video → confirmation; a submission appears in `/admin`
- [ ] "Payment received" + "video received" emails arrive
- [ ] In `/admin`, assign a coach → the row moves to **Assigned**
- [ ] Sign in as that coach at `/login` → `/coach` → download the video → upload
      a feedback file → the row goes **Complete**
- [ ] "Feedback ready" email arrives; its link downloads the feedback file
- [ ] On `/status`, the customer's email shows the submission and a working
      **Watch feedback** button
- [ ] Repeat the upload **on a real phone** — mobile upload is the highest-risk part

---

## 10. Flip to live

- [ ] Swap `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to live keys
- [ ] **Recreate the Stripe webhook in live mode** and update `STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy
- [ ] One **real low-stakes purchase**, end to end, then refund it in Stripe
- [ ] Confirm the money (and the refund) land in the client's Stripe balance

---

## 11. Decommission the dev setup

- [ ] Delete/pause the **dev Vercel project** and its `*.vercel.app` URL
- [ ] Disable/delete the **dev Stripe webhook** (test mode)
- [ ] Revoke any **dev-only keys/tokens** no longer in use
- [ ] **Change the admin email back to the client** if you swapped it during the
      handoff (a swapped-and-forgotten admin login locks the client out)
- [ ] Re-run the step 9 test against production

---

## 12. The operator workflow

Everything runs from the **portal** — no spreadsheet. Operators sign in at
`/login`.

**Statuses:** `awaiting_upload → new → assigned → in_review → complete`. The app
sets the first two; the portal drives the rest.

### Admin (Yuta) — `/admin`

1. The **Submissions** queue lists every submission, newest first. A `new` row
   means a video is in and needs a coach.
2. **Download** the customer's video from the queue if you want to look first.
3. **Assign a coach** from the row's Coach dropdown → the row becomes `assigned`.
4. **Coaches** (`/admin/coaches`) — add a coach (name, email, temporary password,
   specialties, languages). That creates their login and profile.

### Coach — `/coach`

1. **To review** lists the submissions assigned to that coach.
2. **Download video** to review it locally.
3. **Send feedback** — upload the feedback file. That marks the submission
   `complete` and **emails the customer** their download link automatically.

### Customer (no login)

- Checks `/status` with their email; downloads feedback once it's ready.

---

## 13. Endpoint reference

| Route | Trigger | What it does |
| --- | --- | --- |
| `POST /api/payment/intent` | `/start` | Creates a PaymentIntent, returns its client secret |
| `POST /api/webhooks/stripe` | Stripe, on `payment_intent.succeeded` | Creates the submission row (`awaiting_upload`) + payment email |
| `POST /api/upload` | `/upload` | Verifies payment, streams the video to storage, → `new`, video-received email |
| `GET /api/video/[id]` | operator | Streams the customer's video (operator-only, 401 otherwise) |
| `POST /api/feedback/upload` | coach | Stores feedback, → `complete`, feedback-ready email (owner-only) |
| `GET /api/feedback/[id]` | customer | Streams the feedback file once `complete` |
| `POST /api/status` | `/status` | Email-keyed lookup of the customer's submissions |

The Stripe webhook verifies its signature and is idempotent on the payment id.

---

## 14. Troubleshooting

**Payment succeeds but no submission appears.**
Stripe → Webhooks → the endpoint's deliveries. A 400 is a wrong signing secret
(test secret in prod is the usual cause); a 500 is a DB write — check the Vercel
function logs and that `POSTGRES_URL`/`DATABASE_URL` is set.

**Upload or download fails in prod but works locally.**
`BLOB_READ_WRITE_TOKEN` missing → the app falls back to local disk, which is
ephemeral on Vercel. Set the token. Very large files may hit the platform body
limit — see Pending changes.

**Customer got no email.**
Emails are best-effort. Check the Vercel logs for `[email]` lines, that
`RESEND_API_KEY` is set, and that the domain is verified.

**Everything broke right after a domain change.**
The Stripe webhook URL. See the warning at the top.

---

## 15. Pending changes

| Change | Status |
| --- | --- |
| **Stripe keys + webhook** (§5–§6) | **The last launch blocker** — no payments/submissions until done |
| ~~**Verify the Resend domain + set `EMAIL_FROM`**~~ | ✅ Done — domain verified, sending live (§8) |
| ~~**Coach edit**~~ | ✅ Done — `/admin/coaches/[id]`. (Coach *deactivate toggle* exists; hiding inactive coaches from the assign list is a small follow-up) |
| **Customer signup + email verification**, **upload-and-pay** | In flight (Ben) — email how-to in [CLAUDE.md §7](CLAUDE.md#7-third-party-tool-integrations) |
| **Upload before payment** ([ADR 009](docs/decisions/009-upload-before-payment.md)) | Proposed — needs abuse guards + a new status; overlaps Ben's upload-and-pay work |
| **Point the site at `baseball-sensei.com`** + update `NEXT_PUBLIC_SITE_URL` | Optional — on the `.vercel.app` URL today |
| **Forgot-password** (email reset) | Deferred — needs a token flow (change-password already shipped) |
| **Large-file uploads** — direct-to-Blob client upload or chunking for the prod body limit | Fine locally; revisit for prod |

---

_Companion to [CLAUDE.md](CLAUDE.md) (architecture and intent) and
[README.md](README.md) (developer quick start)._
