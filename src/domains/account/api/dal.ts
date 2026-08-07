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
import { HOME_FOR_ROLE, portalsFor } from "../model/session";
import type { OperatorSession } from "../model/session";
import type { Role } from "@/domains/operator/model/operatorRoleEnum";

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
 * Require **any one** of the given kinds.
 *
 * An operator holding several passes if any of them is allowed — the question
 * is *may this person be here*, and holding an extra kind has never been a
 * reason to say no.
 *
 * Someone signed in but not permitted is sent to a portal they *do* hold rather
 * than to `/login`: they are authenticated, just in the wrong place. If they
 * hold more than one, the chooser decides — which is why this redirects there
 * rather than guessing.
 */
export async function requireRole(...allowed: Role[]): Promise<OperatorSession> {
  const session = await requireSession();
  if (session.roles.some((role) => allowed.includes(role))) return session;

  const mine = portalsFor(session.roles);
  redirect(mine.length === 1 ? HOME_FOR_ROLE[mine[0]] : "/portal");
}
