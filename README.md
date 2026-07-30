# Baseball Sensei

An online baseball coaching platform. Parents pay to submit a video of their kid
batting or pitching and get an expert coach's feedback back. Two audiences:

- **Customers** — a public funnel: land → pay → upload → check status → download feedback.
- **Operators** — Yuta (admin) and coaches log into a portal to run the coaching workflow.

Built with **Next.js 16** (App Router, Turbopack), React 19, Tailwind v4,
**Postgres** via **Drizzle**, and object **storage** (local disk in dev, Vercel
Blob in prod). Payments on Stripe; transactional mail on Resend. No Airtable, no
Mux, no external automation — the app is the system of record and the glue.

## The flow

```
CUSTOMER (public, no login)
  Landing → /start (info + Stripe Elements) → /upload (video → storage)
  → confirmation · /status (email lookup) · /api/feedback/[id] (download)

OPERATOR PORTAL (login)
  admin (Yuta): /admin submissions queue · assign a coach · /admin/coaches manage coaches
  coach: /coach assigned reviews · download the video · upload feedback → complete → emails the customer
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

### Local webhook testing

Stripe events won't reach `localhost` on their own — forward them:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# use the printed whsec_... as your local STRIPE_WEBHOOK_SECRET
stripe trigger payment_intent.succeeded
```

Emails are skipped (and logged) when `RESEND_API_KEY` is unset — usually what you
want locally; the flow still works.

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
