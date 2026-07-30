/**
 * The `shared/auth` barrel — the session seam's public surface.
 *
 * Domain-less: it knows a session is a signed JWT with some payload, but not
 * what's in the payload (the account domain owns that shape). `proxy.ts` imports
 * `./token` directly to stay off `next/headers`.
 */
export {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  signSession,
  verifySessionToken,
} from "./token";
export { setSessionCookie, readSession, clearSessionCookie } from "./cookie";
