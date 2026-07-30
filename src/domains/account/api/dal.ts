/**
 * The Data Access Layer for auth — the secure session check, done close to the
 * data (Next.js authentication guide). Pages and actions call these; the proxy
 * only does the optimistic cookie check.
 *
 * `getSession` is memoized per render pass so multiple components can call it
 * without re-verifying the token.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSession } from "@/shared/auth";
import type { OperatorSession, Role } from "../model/user";

/** The verified session, or null if unauthenticated. */
export const getSession = cache(
  async (): Promise<OperatorSession | null> =>
    readSession<OperatorSession>(),
);

/** Require any operator; redirect to /login if not signed in. */
export async function requireSession(): Promise<OperatorSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Require one of the given roles. Wrong-role operators are sent to their own
 * portal rather than /login, since they *are* signed in.
 */
export async function requireRole(...allowed: Role[]): Promise<OperatorSession> {
  const session = await requireSession();
  if (!allowed.includes(session.role)) {
    redirect(session.role === "admin" ? "/admin" : "/coach");
  }
  return session;
}
