/**
 * The `shared/auth` barrel — the signed-session seam's public surface.
 *
 * Domain-less: it knows a session is a signed JWT in an httpOnly cookie, but not
 * what's in the payload. The account domain owns the operator's shape, the
 * submission domain owns the customer flow's. `proxy.ts` imports `./token`
 * directly to stay off `next/headers`.
 */
export {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  signSession,
  verifySessionToken,
} from "./token";
export {
  setSignedCookie,
  readSignedCookie,
  clearSignedCookie,
  setSessionCookie,
  readSession,
  clearSessionCookie,
} from "./cookie";
