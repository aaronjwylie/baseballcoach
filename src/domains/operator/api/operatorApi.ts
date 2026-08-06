/**
 * Operator queries + credential checks against Postgres.
 *
 * The only place the app reads the `operators` table. Callers get a clean
 * `Operator` (no password hash), never a raw row.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { operators } from "../model/operatorsTable";
import type { Operator, Role } from "../model/operator";

/** Raw row lookup — internal; keeps the password hash contained to this file. */
async function findRowByEmail(email: string) {
  const rows = await db
    .select()
    .from(operators)
    .where(eq(operators.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Where operator notifications go.
 *
 * Read from the `operators` table rather than an env var, deliberately: the people
 * who should hear about a payment or a stalled hand-off are exactly the people
 * who can log in and act on it, and a config value would let those two drift the
 * moment an operator changes. Distinct from `site.email` (the public address)
 * and `EMAIL_FROM` (who mail is sent *as*) — three jobs, three sources.
 *
 * Returns every admin, so a second one can be added by creating a user rather
 * than by a deploy. Empty is survivable: the caller skips the send, because
 * nobody being told is better than a crash in a webhook.
 */
export async function listAdminEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: operators.email })
    .from(operators)
    .where(eq(operators.role, "admin"));
  return rows.map((row) => row.email);
}

/** Verify an email + password. Returns the operator, or null if either is wrong. */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<Operator | null> {
  const row = await findRowByEmail(email);
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.passwordHash);
  return ok ? { id: row.id, email: row.email, role: row.role } : null;
}

export async function getOperatorById(id: string): Promise<Operator | null> {
  const rows = await db
    .select({ id: operators.id, email: operators.email, role: operators.role })
    .from(operators)
    .where(eq(operators.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Create a coach's login. Admin-only (the caller enforces that). Returns the new
 * operator; the coaches row is created alongside by the coach domain.
 */
export async function createOperator(
  email: string,
  password: string,
  role: Role,
): Promise<Operator> {
  const passwordHash = await bcrypt.hash(password, 10);
  const rows = await db
    .insert(operators)
    .values({ email: email.trim().toLowerCase(), passwordHash, role })
    .returning({ id: operators.id, email: operators.email, role: operators.role });
  return rows[0];
}

/**
 * Change an operator's password. Verifies the current one first; returns false
 * if it's wrong (or the user is gone), true on success.
 */
export async function changePassword(
  operatorId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const [row] = await db
    .select({ passwordHash: operators.passwordHash })
    .from(operators)
    .where(eq(operators.id, operatorId))
    .limit(1);
  if (!row) return false;

  const ok = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!ok) return false;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(operators).set({ passwordHash }).where(eq(operators.id, operatorId));
  return true;
}

/**
 * Set a password directly, no current-password check — for an admin resetting a
 * coach's, and for the forgot-password flow. The authority comes from being an
 * admin or holding a valid reset token, not from knowing the old password.
 * Hashing stays in this file, the one home for it.
 */
export async function setUserPassword(
  operatorId: string,
  newPassword: string,
): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(operators).set({ passwordHash }).where(eq(operators.id, operatorId));
}
