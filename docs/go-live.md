# Go-Live Handoff Checklist

Moving this app from the dev account to the client's own accounts and taking
real payments. Everything below assumes the **client owns all third-party
accounts** (Stripe, Mux, Airtable, Resend) — payments and data go to them.

Work top to bottom. Nothing here touches application code; it's all
configuration in dashboards. The one rule that has bitten us before: **every
webhook URL is derived from the site URL, so if the domain changes, re-point
every webhook** or the flow silently breaks.

---

## 1. Move the code

- [ ] **Transfer the GitHub repo** to the client's GitHub account/org
      (GitHub → repo **Settings → Transfer ownership**), *or* have the client
      create their own repo and push the code there.
- [ ] Client **imports the repo into their own Vercel account**
      (Vercel → **Add New → Project → Import Git Repository**).
- [ ] Confirm the client's Vercel is connected to the repo on the `main` branch.
- [ ] Ensure commits deploy: the committing Git email must match a GitHub
      account on the client's side, or Vercel **blocks** the build.

## 2. Client creates their own service accounts

- [ ] **Stripe** — account created and business/bank details completed so it can
      accept live charges.
- [ ] **Mux** — account + an access token (Settings → Access Tokens).
- [ ] **Airtable** — account + a base (see step 3).
- [ ] **Resend** — account + a **verified sending domain** (required for emails
      to actually deliver; without it, emails are silently skipped).

## 3. Rebuild the Airtable base

The app reads/writes an Airtable table with **exact** field names. Recreate the
base (or duplicate the dev base into the client's workspace) with a table named
`Submissions` (or set `AIRTABLE_TABLE_NAME`):

| Field | Type |
| --- | --- |
| `Email` | Single line text |
| `Player Name` | Single line text |
| `Player Age` | Single line text |
| `Sport` | Single line text |
| `Notes` | Long text |
| `Status` | Single select — options: `Awaiting Upload`, `In Review`, `Complete` |
| `Stripe Session ID` | Single line text |
| `Mux Upload ID` | Single line text |
| `Mux Asset ID` | Single line text |
| `Mux Playback ID` | Single line text |
| `Feedback Link` | URL |
| `Created At` | Single line text |
| `Feedback Emailed` | Checkbox |

- [ ] Table + all fields created with names matching exactly.
- [ ] Create a **Personal Access Token** (scopes `data.records:read`,
      `data.records:write`) for `AIRTABLE_API_KEY`.
- [ ] Note the **Base ID** (`app…`) for `AIRTABLE_BASE_ID`.

## 4. Set environment variables (client's Vercel → Settings → Environment Variables, **Production**)

| Variable | Value / source |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The live production URL, **no trailing slash** (e.g. `https://baseballcoach.com`) |
| `STRIPE_SECRET_KEY` | Client's Stripe **live** key `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | From the Stripe webhook created in step 5 (`whsec_…`) |
| `STRIPE_PRICE_ID` | *Optional.* A pre-created Stripe Price; leave unset to price inline from `src/lib/site.ts` |
| `MUX_TOKEN_ID` | Client's Mux token ID |
| `MUX_TOKEN_SECRET` | Client's Mux token secret |
| `MUX_WEBHOOK_SECRET` | From the Mux webhook created in step 5 |
| `AIRTABLE_API_KEY` | Client's Airtable PAT |
| `AIRTABLE_BASE_ID` | Client's base ID (`app…`) |
| `AIRTABLE_TABLE_NAME` | *Optional.* Defaults to `Submissions` |
| `AIRTABLE_WEBHOOK_SECRET` | A random secret (e.g. `openssl rand -hex 32`); also used in step 6 |
| `RESEND_API_KEY` | Client's Resend key (emails skipped if unset) |
| `EMAIL_FROM` | A verified sender, e.g. `Diamond Path <hello@theirdomain.com>` |

- [ ] All of the above set for **Production**.
- [ ] Also review the customer-facing content in `src/lib/site.ts` (business
      name, price, coach bios, contact email) and update for the client.
- [ ] **Redeploy** after setting vars — env changes only apply to a new build.

## 5. Configure the Stripe & Mux webhooks

Do this **after** the domain is final, so the URLs are correct.

- [ ] **Stripe** → Developers → Webhooks → Add endpoint
      `https://<site>/api/webhooks/stripe`, event `checkout.session.completed`.
      Copy its signing secret → `STRIPE_WEBHOOK_SECRET`.
- [ ] **Mux** → Settings → Webhooks → add `https://<site>/api/webhooks/mux`
      (events `video.asset.ready`, `video.asset.errored`). Copy its signing
      secret → `MUX_WEBHOOK_SECRET`.
- [ ] Redeploy so the new secrets take effect.

## 6. Configure the feedback-ready Airtable automation

- [ ] Airtable base → **Automations** → new automation.
- [ ] **Trigger:** *When a record matches conditions* → `Status` is `Complete`
      **and** `Feedback Link` is not empty.
- [ ] **Action:** *Send request* →
      - Method `POST`
      - URL `https://<site>/api/webhooks/airtable`
      - Header `x-webhook-secret: <AIRTABLE_WEBHOOK_SECRET>`
      - JSON body `{ "recordId": "<record id from the trigger step>" }`
- [ ] Turn the automation **on**.

## 7. Domain

- [ ] Add the client's custom domain in Vercel → Settings → Domains and complete
      DNS verification.
- [ ] Confirm `NEXT_PUBLIC_SITE_URL` matches the final domain exactly, then
      redeploy.
- [ ] Re-check that all three webhook URLs (steps 5–6) point at the final domain.

## 8. End-to-end test — in TEST mode first

Use Stripe **test** keys and Stripe test cards before flipping to live.

- [ ] From `/start`, complete a checkout with test card `4242 4242 4242 4242`.
- [ ] Redirect lands on `/upload?session_id=…` on the **live domain** (not localhost).
- [ ] An Airtable row appears with `Status = Awaiting Upload`; "payment received"
      email arrives.
- [ ] Upload a short video; row flips to `In Review`; "video received" email arrives.
- [ ] In Airtable, paste a `Feedback Link` and set `Status = Complete`.
- [ ] "Feedback ready" email arrives with a working link; `Feedback Emailed`
      checkbox gets ticked.
- [ ] On `/status`, entering the same email shows the submission and a working
      **Watch feedback** button.

## 9. Flip to live

- [ ] Swap `STRIPE_SECRET_KEY` to the **live** `sk_live_…` key.
- [ ] Recreate the Stripe webhook in **live mode** (test/live webhooks are
      separate) and update `STRIPE_WEBHOOK_SECRET`.
- [ ] Redeploy.
- [ ] Do **one real low-stakes purchase** end to end, then refund it in Stripe.
- [ ] Confirm the money appears in the client's Stripe balance.

## 10. Decommission the dev setup

Once the client's site is live and verified, tear down the old dev deployment so
nothing keeps firing against test data or duplicating work.

- [ ] Delete (or pause) the **dev Vercel project** so its deployment and any
      `*.vercel.app` URL stop serving.
- [ ] Disable/delete the **dev Stripe webhook** (test mode) so it no longer fires.
- [ ] Disable/delete the **dev Mux webhook**.
- [ ] Turn off the **dev Airtable automation** (and archive the dev base if it
      held only test rows).
- [ ] Revoke any **dev-only API keys/tokens** that are no longer used.
- [ ] Confirm the production site still passes the step 8 test after teardown —
      i.e. nothing live depended on a dev resource.

---

### Quick reference — endpoints in this app

| Route | Purpose |
| --- | --- |
| `POST /api/checkout` | Creates the Stripe Checkout session |
| `POST /api/webhooks/stripe` | Payment → creates Airtable row + payment email |
| `POST /api/mux/upload` | Issues a Mux direct-upload URL |
| `POST /api/webhooks/mux` | Video ready → `In Review` + video-received email |
| `POST /api/webhooks/airtable` | `Complete` → feedback-ready email |
| `POST /api/status` | Email-keyed status lookup for `/status` |
