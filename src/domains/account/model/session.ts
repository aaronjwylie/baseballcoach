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
  role: Role;
}

/** Return shape of the login server action, for `useActionState`. */
export type LoginState = { error: string } | undefined;

/** Return shape of the change-password server action. */
export type ChangePasswordState = { error: string } | { ok: true } | undefined;

