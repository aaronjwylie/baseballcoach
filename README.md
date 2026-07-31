# Baseball Sensei

An online baseball coaching platform. Parents pay to submit a **pack of files** —
clips of their kid batting or pitching, plus any stills or documents that help —
and get an expert coach's feedback back. Two audiences:

- **Customers** — a public funnel: land → verify email → upload → pay → check status → download feedback. No account, ever.
- **Operators** — Yuta (admin) and coaches log into a portal to run the coaching workflow.

Built with **Next.js 16** (App Router, Turbopack), React 19, Tailwind v4,
**Postgres** via **Drizzle**, and object **storage** (local disk in dev, Vercel
Blob in prod). Payments on Stripe; transactional mail on Resend. No Airtable, no
Mux, no external automation — the app is the system of record and the glue.

## The flow

```
CUSTOMER (public, no login)
  Landing → /start, four steps on one route:
    1 player details  2 verify email (6-digit code)  3 upload files  4 pay
  → confirmation · /status (email lookup) · /api/feedback/[id] (download)

  Payment is LAST, so nobody pays for a submission whose upload then fails (ADR 009).
  Uploads go straight to Blob in production — a Vercel request body caps near
  4.5 MB and a phone video doesn't (ADR 011).

OPERATOR PORTAL (login)
  admin (Yuta): /admin queue · assign a coach · /admin/coaches · /admin/settings (limits + retention)
  coach: /coach assigned reviews · download the files · upload feedback → complete → emails the customer

NIGHTLY
  /api/cron/sweep deletes customer uploads past their retention window.
  The coach's feedback file is never swept.
```

## Local development

Everything runs locally against a **dockerized Postgres** and **local-disk
storage** — no cloud accounts needed to develop (only Stripe test keys to
exercise payment).

```bash
# 1. Postgres
docker compose up -d db            # Postgres 16 on localhost:5434

# 2. Env — copy the template and fill in Stripe test keys + an AUTH_SECRET
cp .env.example .env.local
#   AUTH_SECRET:  openssl rand -base64 32
#   DATABASE_URL is already pointed at the docker db; STORAGE_DIR defaults to ./.storage
#   RESEND_API_KEY: needed to walk the flow in a browser — the code is emailed.
#                   `npm run flow` exercises that path without it.

# 3. Install, migrate, seed
npm install
npm run db:migrate                 # apply the schema
npm run db:seed                    # first admin (+ sample coach & submissions if SEED_SAMPLES=1)

# 4. Run
npm run dev                        # http://localhost:3000
```

Sign in at `/login` as the seeded admin — **`yuta@example.com` / `changeme123`**
(dev default) — to reach `/admin`.

DB scripts: `db:generate` (create a migration from the schema) · `db:migrate` ·
`db:push` · `db:studio` · `db:seed`.

Probes that exercise the server side without a browser:

```bash
npm run flow                       # the 4 steps + the retention sweep, asserted
npm run payment                    # a real Stripe test-mode payment, end to end
```

### Local webhook testing

Stripe events won't reach `localhost` on their own — forward them:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# use the printed whsec_... as your local STRIPE_WEBHOOK_SECRET
stripe trigger payment_intent.succeeded
```

Emails are skipped (and logged) when `RESEND_API_KEY` is unset. That's usually
what you want locally — **except that step 2 of the customer flow emails a
verification code**, so a browser walkthrough needs a real key. `npm run flow`
covers that path without one.

## Where things are documented

| Question | Look in |
| --- | --- |
| What are we building, and why this way? | [CLAUDE.md](CLAUDE.md) |
| How is the code laid out? | [docs/design/structure.md](docs/design/structure.md) · [PRINCIPLES.md](PRINCIPLES.md) |
| How do I provision / deploy / run it as the client? | [OPERATIONS.md](OPERATIONS.md) |
| Why is *this* done this odd way? | [docs/decisions/](docs/decisions/) |
| Per-slice detail (northstar, state, history) | `src/domains/*/_XxxDocumentation.md` |

## Notes on Next.js 16

Breaking changes vs. earlier versions: **`middleware` is now `proxy`**, `params`,
`searchParams`, and `cookies()` are **async**, Turbopack is default. Before
changing framework-level code, read the relevant guide in
`node_modules/next/dist/docs/` — see [AGENTS.md](AGENTS.md).
