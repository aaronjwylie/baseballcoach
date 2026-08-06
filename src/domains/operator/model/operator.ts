/**
 * The operator (the admin + coachTable) — the operator domain's noun.
 *
 * Operators are the only people who authenticate; customers never get a user
 * row. The password hash never appears here — it stays in the DB row and is
 * read only by `verifyCredentials`.
 */

/**
 * The two operator roles — the vocabulary `userRoleEnum.ts` derives from.
 *
 * A list rather than a bare union so there is one home for the fact. Customers
 * are not a third role and never will be: they don't get a `operatorTable` row at all.
 */
export const ROLES = ["admin", "coach"] as const;

export type Role = (typeof ROLES)[number];

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
