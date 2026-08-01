/**
 * Operator queries + credential checks against Postgres.
 *
 * The only place the app reads the `users` table. Callers get a clean
 * `Operator` (no password hash), never a raw row.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "@/shared/db";
import type { Operator, Role } from "../model/user";

/** Raw row lookup — internal; keeps the password hash contained to this file. */
async function findRowByEmail(email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
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
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, id))
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
    .insert(users)
    .values({ email: email.trim().toLowerCase(), passwordHash, role })
    .returning({ id: users.id, email: users.email, role: users.role });
  return rows[0];
}

/**
 * Change an operator's password. Verifies the current one first; returns false
 * if it's wrong (or the user is gone), true on success.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return false;

  const ok = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!ok) return false;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  return true;
}

/**
 * Set a password directly, no current-password check — for an admin resetting a
 * coach's, and for the forgot-password flow. The authority comes from being an
 * admin or holding a valid reset token, not from knowing the old password.
 * Hashing stays in this file, the one home for it.
 */
export async function setUserPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
