import type { Role } from "@/domains/account";

/**
 * The operator (the admin + coaches) — the operator domain's noun.
 *
 * Operators are the only people who authenticate; customers never get a user
 * row. The password hash never appears here — it stays in the DB row and is
 * read only by `verifyCredentials`.
 */






/** An operator as the app uses one. Never carries the password hash. */
export interface Operator {
  id: string;
  email: string;
  role: Role;
}
