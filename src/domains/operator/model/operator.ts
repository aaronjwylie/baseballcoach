/**
 * The operator (the admin + coaches) — the operator domain's noun.
 *
 * Operators are the only people who authenticate; customers never get a user
 * row. The password hash never appears here — it stays in the DB row and is
 * read only by `verifyCredentials`.
 */

/**
 * The two operator roles — the vocabulary `userRoleEnum.ts` derives from.
 *
 * A list rather than a bare union so there is one home for the fact. Customers
 * are not a third role and never will be: they don't get a `operators` row at all.
 */
export const ROLES = ["admin", "coach", "translator"] as const;

export type Role = (typeof ROLES)[number];

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

/**
 * Who can be given a submission.
 *
 * The admin assigns; they are not assigned to. Coaches and translators both
 * take work, which is the only thing that distinguishes them from an admin at
 * this level — and nothing distinguishes them from each other.
 */
export const CAN_BE_ASSIGNED: Record<Role, boolean> = {
  admin: false,
  coach: true,
  translator: true,
};

/** The session cookie payload — minimal, no PII (CLAUDE.md authentication). */
export interface OperatorSession {
  operatorId: string;
  role: Role;
}

/** An operator as the app uses one. Never carries the password hash. */
export interface Operator {
  id: string;
  email: string;
  role: Role;
}

/** Return shape of the login server action, for `useActionState`. */
export type LoginState = { error: string } | undefined;

/** Return shape of the change-password server action. */
export type ChangePasswordState = { error: string } | { ok: true } | undefined;
