/**
 * Session token crypto — sign and verify the stateless session JWT.
 *
 * Deliberately free of `next/headers` so this module is safe to import from
 * `proxy.ts` (which reads the cookie off the request directly). The cookie
 * store lives in `cookie.ts`, which does depend on `next/headers`.
 *
 * The payload is intentionally tiny (userId + role, see the account domain) —
 * no PII, no secrets. HS256 signed with AUTH_SECRET.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/shared/config/env";

export const SESSION_COOKIE = "bs_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

function key(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

export async function signSession(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
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
