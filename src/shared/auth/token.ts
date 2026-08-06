/**
 * Session token crypto — sign and verify a stateless signed cookie.
 *
 * Deliberately free of `next/headers` so this module is safe to import from
 * `proxy.ts` (which reads the cookie off the request directly). The cookie
 * store lives in `cookie.ts`, which does depend on `next/headers`.
 *
 * Payload-agnostic on purpose. Two different sessions ride on this crypto and
 * neither shape is known here:
 *
 * - the **operator** session (`bs_session`, 7 days) — operatorId + role, owned by
 *   the operator domain;
 * - the **customer flow** session (`bs_flow`, hours) — a submission id, owned by
 *   the submission domain, proving this browser started that submission.
 *
 * Both are tiny: no PII, no secrets. HS256 signed with AUTH_SECRET.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/shared/config/env";

export const SESSION_COOKIE = "bs_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

function key(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

/**
 * Sign a payload. `maxAgeSeconds` sets the JWT's own expiry, which is the one
 * that matters — a cookie `maxAge` is a hint the browser may ignore, but an
 * expired token fails verification server-side.
 */
export async function signSession(
  payload: JWTPayload,
  maxAgeSeconds: number = SESSION_MAX_AGE_S,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(key());
}

/** Verify and decode a token. Returns null for missing/invalid/expired. */
export async function verifySessionToken<T>(
  token: string | undefined | null,
): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
    });
    return payload as T;
  } catch {
    return null;
  }
}
