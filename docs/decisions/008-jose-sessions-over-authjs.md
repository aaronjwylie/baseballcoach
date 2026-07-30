# 008 — First-party jose sessions over Auth.js

**Status:** Accepted (2026-07-29) · Settles the auth sub-decision left open in
[ADR 007](007-portal-and-postgres-retire-airtable.md)

## Problem

ADR 007 said the operator portal needed auth and was "leaning Auth.js, final call
at build." This is the build. The actual requirement is narrow:

- **Credentials only** — email + password for a handful of **seeded** operators.
- **Two roles** — `admin` (Yuta) and `coach`.
- **No** customer-facing auth, OAuth, magic links, or multi-device session
  management.

Against that, two facts matter: Next.js **16.2 is bleeding-edge**, and Auth.js v5
is still **beta**. The Next authentication guide itself warns that an auth
library must be checked for runtime compatibility with Proxy (the renamed
Middleware), and that some only support the Edge runtime.

## Decision

**Use the first-party pattern from the Next.js authentication guide**: a
`jose`-signed HS256 JWT in an httpOnly cookie, plus a small DAL
(`requireSession` / `requireRole`) for secure checks and an optimistic
`proxy.ts` gate. **Not Auth.js.**

Shape:

- `shared/auth/token.ts` — sign/verify the JWT (no `next/headers`, so `proxy.ts`
  can use it).
- `shared/auth/cookie.ts` — set/read/clear the cookie via async `cookies()`.
- `domains/account/` — the operator noun (`userApi` credential check with
  bcrypt), the DAL guards, the `login`/`logout` server actions, `LoginForm`.
- `proxy.ts` — optimistic cookie check + coarse role routing.

## Why this over Auth.js

- **Less code, not more.** The whole thing is ~4 small files. Wiring Auth.js v5 +
  a Drizzle adapter + a credentials provider for features we don't use (OAuth,
  email, adapters) would be more surface, not less — the opposite of the north
  star ("build exactly as much platform as needed").
- **No beta dependency** riding on a bleeding-edge Next release. Nothing to break
  on the next Auth.js beta or Next patch.
- **The seam is tiny.** Token + cookie + DAL is a swappable boundary.

## Consequences

- Adds `jose` and `bcryptjs`; `AUTH_SECRET` env var. No auth SaaS vendor.
- Passwords are bcrypt-hashed; the hash never leaves `userApi.ts`.
- Session payload is minimal (`{ userId, role }`) — no PII in the token.
- **Auth.js remains the documented exit.** If we later need OAuth, magic links,
  or device management, the small seam swaps out for it. Updates the §4 "Auth"
  row and §7 "Auth.js" note in CLAUDE.md, which now describe this approach.
