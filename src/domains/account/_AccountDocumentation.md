# account — operator identity

## The northstar

`account` is who can log into the operator portal and what they're allowed to
touch. Two roles: **admin** (Yuta) and **coach**. **Customers are never accounts** —
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

## Where we are

- ✅ `login` / `logout` server actions, credential check against Postgres
  (bcrypt), signed session cookie.
- ✅ `requireSession` / `requireRole` DAL guards; `proxy.ts` optimistic routing
  for `/admin`, `/coach`, `/login`.
- ✅ `LoginForm` + `/login`; stub `/admin` and `/coach` landing pages behind the
  guards.
- ✅ First admin seeded by `npm run db:seed`.
- 🔶 `createOperator` exists but isn't wired to a UI yet — the admin
  coach-management screen (which pairs a `users` row with a `coaches` row) comes
  with the admin portal.
- 🔶 No password reset / change-password yet.

## Where we came from

- **2026-07-29** — Built as part of the operator-portal pivot
  ([ADR 007](../../../docs/decisions/007-portal-and-postgres-retire-airtable.md)).
  Chose a first-party `jose` session + DAL over Auth.js
  ([ADR 008](../../../docs/decisions/008-jose-sessions-over-authjs.md)): Next 16.2
  is bleeding-edge, Auth.js v5 is beta, and we need only credentials + two roles.
  Less code, no beta dependency. Auth.js stays the documented exit if we later
  need OAuth or magic links.
