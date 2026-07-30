/**
 * The operator (Yuta + coaches) — the account domain's noun.
 *
 * Operators are the only people who authenticate; customers never get a user
 * row. The password hash never appears here — it stays in the DB row and is
 * read only by `verifyCredentials`.
 */

export type Role = "admin" | "coach";

/** The session cookie payload — minimal, no PII (CLAUDE.md authentication). */
export interface OperatorSession {
  userId: string;
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
