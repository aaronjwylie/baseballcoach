# account — operator identity

## The northstar

`account` is who can log into the operator portal and what they're allowed to
touch. Two roles: **admin** (the admin) and **coach**. **Customers are never accounts** —
they're identified by the email on their submission, not a login.

The noun is an `Operator` (`{ id, email, role }`) — the password hash never
leaves `api/userApi.ts`. The verbs are `login` / `logout` (server actions) and
the guards `requireSession` / `requireRole` (the DAL). The session is a stateless
HS256 JWT in an httpOnly cookie; the crypto seam lives in `shared/auth`, this
domain owns the payload shape (`OperatorSession = { userId, role }`).

Invariants:

- The DAL is the **secure** check, done close to the data (in pages / actions).
- `proxy.ts` is only an **optimistic** check (cookie present + coarse role
  routing); it is never the sole line of defence.
- A wrong-role operator is redirected to *their* portal, not to `/login` — they
  are authenticated, just in the wrong place.

## Where we are — 2026-08-01

- ✅ **`listAdminEmails()`** — where operator notifications go, read from the
  `users` table rather than an env var. The people who should hear about a stalled
  hand-off or a new payment are exactly the people who can log in and act on it,
  and a config value would let those two drift the moment an operator changes.
  Distinct from `site.email` (the public address) and `EMAIL_FROM` (who mail is
  sent *as*) — three jobs, three sources.

  Returns **every** admin, so a second one is added by creating a user rather
  than by a deploy. Empty is survivable: the caller skips the send, because
  nobody being told is better than a crash inside a webhook.
- ✅ **Forgot-password** for operators (Aaron, 2026-08-01) — a one-hour reset
  link. ⚠️ It joins the verification code as a message whose recipient is
  **blocked** on it, which ADR 004's best-effort default serves badly. Two
  instances is a pattern worth deciding about.

## Where we were before that

- ✅ `login` / `logout` server actions, credential check against Postgres
  (bcrypt), signed session cookie.
- ✅ `requireSession` / `requireRole` DAL guards; `proxy.ts` optimistic routing
  for `/admin`, `/coach`, `/login`.
- ✅ `LoginForm` + `/login`; stub `/admin` and `/coach` landing pages behind the
  guards.
- ✅ First admin seeded by `npm run db:seed`.
- ✅ `createOperator` is wired to the admin coach-management screen (creates a
  `users` + `coaches` pair).
- ✅ **Change password** at `/account` (any signed-in operator) — verifies the
  current password, then updates the hash. Covers the seeded-admin gap.
- 🔶 **No forgot-password (unauthenticated email reset) yet** — it needs a reset-token
  flow and a verified Resend domain. Change-password (authenticated) covers the
  urgent case for now.

## Where we came from

- **2026-07-29** — Built as part of the operator-portal pivot
  ([ADR 007](../../../docs/decisions/007-portal-and-postgres-retire-airtable.md)).
  Chose a first-party `jose` session + DAL over Auth.js
  ([ADR 008](../../../docs/decisions/008-jose-sessions-over-authjs.md)): Next 16.2
  is bleeding-edge, Auth.js v5 is beta, and we need only credentials + two roles.
  Less code, no beta dependency. Auth.js stays the documented exit if we later
  need OAuth or magic links.
