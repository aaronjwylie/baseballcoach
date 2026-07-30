/**
 * The session cookie store — set, read, clear.
 *
 * Uses Next's async `cookies()` (Next 16), so this is server-only: importable
 * from Server Components, Server Actions, and Route Handlers, but not from
 * `proxy.ts` (use `token.ts` + `req.cookies` there).
 */
import { cookies } from "next/headers";
import type { JWTPayload } from "jose";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  signSession,
  verifySessionToken,
} from "./token";

export async function setSessionCookie(payload: JWTPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function readSession<T>(): Promise<T | null> {
  const store = await cookies();
  return verifySessionToken<T>(store.get(SESSION_COOKIE)?.value);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
