/**
 * Passwords — **the only file that touches `operatorTable.passwordHash`.**
 *
 * That sentence is the point of the file existing, and it is checkable:
 *
 * ```
 * grep -rn "passwordHash" src/domains/operator/
 * ```
 *
 * should name this file and `operatorTable.ts` (which declares the column) and
 * nothing else. Same for `bcrypt`. Outside the domain, `scripts/seed.ts` and
 * `scripts/simulate.ts` write the column directly — they run against a database
 * with no app in front of them, which is the one situation this boundary isn't
 * trying to govern.
 *
 * It held on the first try everywhere except the forgot-password flow, which
 * needed a slice of the hash to make its emailed link single-use. That is what
 * `passwordFingerprint` below is for: the reasonable use survives, without the
 * hash surviving with it.
 *
 * ## Why creating an operator lives here
 *
 * `createOperator` reads like a record function and was one, in the file next
 * door. It moved because the alternative was exporting a `hashPassword` helper
 * for it to call — and a hasher that leaves this file is a hasher that can be
 * called from anywhere, which is most of the containment gone in exchange for
 * filing one function under the heading that reads better.
 *
 * The honest framing is that creating an operator row **is** minting a
 * credential. The row's entire purpose is to be signed into; the parts of a
 * person that aren't a login — their name in a list, their languages, their bio
 * — live on `operator_profile` and are created by `coachApi.createCoach`. So the
 * seam already ran here. This file just stopped pretending otherwise.
 *
 * ## What callers get
 *
 * An `Operator` — id, email, role. Never a row, so a hash cannot escape by
 * being spread into a response or logged by an error handler that prints its
 * argument.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { operatorTable } from "../model/operatorTable";
import type { Operator, Role } from "../model/operator";

/** The one cost factor. A second literal somewhere else is a second policy. */
const COST = 10;

/**
 * How much of the hash a fingerprint carries. Enough that two live hashes
 * cannot collide; short enough that the fingerprint is not itself a hash worth
 * attacking if a reset link leaks.
 */
const FINGERPRINT_LENGTH = 24;

/**
 * Verify an email + password.
 *
 * Returns the operator, or null if **either** is wrong — deliberately one
 * answer for both, so a caller cannot turn this into a test for which emails
 * exist.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<Operator | null> {
  const [row] = await db
    .select()
    .from(operatorTable)
    .where(eq(operatorTable.email, email.trim().toLowerCase()))
    .limit(1);
  if (!row) return null;

  const ok = await bcrypt.compare(password, row.passwordHash);
  return ok ? { id: row.id, email: row.email, role: row.role } : null;
}

/**
 * Mint a login. Admin-only — the caller enforces that.
 *
 * The profile row that makes someone a coach is created alongside, by
 * `coachApi.createCoach`. This half only ever produces someone who can sign in.
 */
export async function createOperator(
  email: string,
  password: string,
  role: Role,
  name: string,
): Promise<Operator> {
  const passwordHash = await bcrypt.hash(password, COST);
  const [row] = await db
    .insert(operatorTable)
    .values({ email: email.trim().toLowerCase(), passwordHash, role, name })
    .returning({
      id: operatorTable.id,
      email: operatorTable.email,
      role: operatorTable.role,
    });
  return row;
}

/**
 * Change a password, proving the current one first.
 *
 * False covers both "wrong password" and "no such operator", for the same
 * reason `verifyCredentials` conflates its two failures.
 */
export async function changePassword(
  operatorId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const [row] = await db
    .select({ passwordHash: operatorTable.passwordHash })
    .from(operatorTable)
    .where(eq(operatorTable.id, operatorId))
    .limit(1);
  if (!row) return false;

  const ok = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!ok) return false;

  await setOperatorPassword(operatorId, newPassword);
  return true;
}

/**
 * An opaque marker that changes when the password does.
 *
 * The forgot-password flow binds its emailed link to one of these, which makes
 * the link single-use with no schema change: setting a new password changes the
 * hash, so a spent link no longer matches. It is a slice of the hash — which is
 * exactly why the *slicing* happens here and the caller gets a string it can
 * only compare. Reading a password hash to build a token is a reasonable thing
 * to do and a bad thing to spread.
 *
 * Null if there is no such operator, which the caller must treat as a mismatch
 * rather than a pass.
 */
export async function passwordFingerprint(
  operatorId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ passwordHash: operatorTable.passwordHash })
    .from(operatorTable)
    .where(eq(operatorTable.id, operatorId))
    .limit(1);
  return row ? row.passwordHash.slice(0, FINGERPRINT_LENGTH) : null;
}

/**
 * Set a password outright, with no check of the old one — for an admin
 * resetting a coach's, and for the forgot-password flow.
 *
 * **The authority is the caller's, not the password's**: being an admin, or
 * holding a valid single-use reset token. Both are established before this is
 * reached, which is why it takes an id and asks nothing.
 */
export async function setOperatorPassword(
  operatorId: string,
  newPassword: string,
): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, COST);
  await db
    .update(operatorTable)
    .set({ passwordHash })
    .where(eq(operatorTable.id, operatorId));
}
