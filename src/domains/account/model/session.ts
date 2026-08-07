/**
 * The session payload, and where each role lands.
 *
 * `Role` itself belongs to `operator` — it is a kind of operator, not a
 * permission — and is imported here from the declaration plane, which is the
 * one route that does not close a cycle. What is genuinely this domain's is
 * *what a session carries* and *where signing in sends you*.
 */
import type { Role } from "@/domains/operator/model/operatorRoleEnum";

/**
 * Where each role lands after signing in, and where a wrong-role visitor is sent
 * back to.
 *
 * **A Record, not a ternary.** It was `role === "admin" ? "/admin" : "/coach"`
 * in three places, which meant adding `translator` silently routed them to the
 * coach portal — a portal `proxy.ts` then bounces them out of, so the first
 * translator to sign in would have hit a redirect loop. Nothing failed to
 * compile. This makes a fourth role a compile error instead.
 */
export const HOME_FOR_ROLE: Record<Role, string> = {
  admin: "/admin",
  coach: "/coach",
  translator: "/translator",
};

/** The session cookie payload — minimal, no PII (CLAUDE.md authentication). */
export interface OperatorSession {
  operatorId: string;
  /**
   * **Every kind they are**, not one.
   *
   * A person can run the platform and coach; a coach who reads both languages
   * can translate their own submissions. The session carries the whole set so a
   * guard never has to go back to the database to ask a second time.
   *
   * **Changing this shape signs everyone out once.** An old cookie carries
   * `role` and no `roles`, so it fails to parse and reads as no session — which
   * is the safe direction for a session change to fail.
   */
  roles: Role[];
}

/**
 * Where to send someone who holds several kinds, when they have not chosen.
 *
 * Not a hierarchy — holding `admin` does not contain holding `coach`. It is
 * only a tiebreak for the portal chooser's default, and the reason it is
 * admin-first is that someone who runs the platform is usually here to run it.
 */
export const PORTAL_ORDER: readonly Role[] = ["admin", "coach", "translator"];

/** The portals this person may enter, in the order the chooser lists them. */
export function portalsFor(roles: Role[]): Role[] {
  return PORTAL_ORDER.filter((role) => roles.includes(role));
}

/** Return shape of the login server action, for `useActionState`. */
export type LoginState = { error: string } | undefined;

/** Return shape of the change-password server action. */
export type ChangePasswordState = { error: string } | { ok: true } | undefined;

