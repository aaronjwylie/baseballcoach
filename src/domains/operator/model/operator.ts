import type { Role } from "./operatorRoleEnum";

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

