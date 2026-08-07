/**
 * Passwords — **the only file that touches `operator_credential.password_hash`.**
 *
 * That sentence is the point of the file, and it is checkable:
 *
 * ```
 * grep -rn "passwordHash" src/
 * ```
 *
 * should name this file and `operatorCredentialTable.ts` and nothing else.
 * Same for `bcrypt`. (`scripts/seed.ts` writes the column directly — it runs
 * against a database with no app in front of it, which is the one situation
 * this boundary is not trying to govern.)
 *
 * ## Everything here is keyed by an operator id
 *
 * **This domain does not know what an email is, or what a role is**, and that
 * is what keeps the graph acyclic: `operator` imports `account`, never the
 * reverse. A flow that starts from an email — logging in, requesting a reset —
 * resolves the id in `operator` first and then arrives here with a secret and
 * an id, which is all this domain has ever needed.
 *
 * ## Why it is its own domain
 *
 * An operator is a person in the business; an account is a capability granted
 * to them. A coach can exist before anyone gives them a login. Those are two
 * nouns, and until 2026-08-06 they shared a table — which is what made this
 * split look impossible twice (`_StructureLaw.md` §5b).
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { operatorCredentialTable } from "../model/operatorCredentialTable";


/** The one cost factor. A second literal somewhere else is a second policy. */
const COST = 10;

/**
 * How much of the hash a fingerprint carries. Enough that two live hashes
 * cannot collide; short enough that the fingerprint is not itself a hash worth
 * attacking if a reset link leaks.
 */
const FINGERPRINT_LENGTH = 24;



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
    .select({ passwordHash: operatorCredentialTable.passwordHash })
    .from(operatorCredentialTable)
    .where(eq(operatorCredentialTable.operatorId, operatorId))
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
    .select({ passwordHash: operatorCredentialTable.passwordHash })
    .from(operatorCredentialTable)
    .where(eq(operatorCredentialTable.operatorId, operatorId))
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
    .update(operatorCredentialTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(operatorCredentialTable.operatorId, operatorId));
}

/**
 * Does this secret match? The whole of what a login needs from this domain.
 *
 * Takes an **id**, never an email — resolving an address to a person is
 * `operator`'s job, and keeping it there is what stops the two domains
 * importing each other. False when there is no credential row at all, which is
 * a real state: an operator can exist before anyone gives them a login.
 */
export async function verifyPassword(
  operatorId: string,
  password: string,
): Promise<boolean> {
  const [row] = await db
    .select({ passwordHash: operatorCredentialTable.passwordHash })
    .from(operatorCredentialTable)
    .where(eq(operatorCredentialTable.operatorId, operatorId))
    .limit(1);
  if (!row) return false;
  return bcrypt.compare(password, row.passwordHash);
}

/**
 * Grant someone the ability to sign in.
 *
 * Separate from creating the person, because they are separate acts on separate
 * rows — and the schema can now say what the code always meant.
 */
export async function createCredential(
  operatorId: string,
  password: string,
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, COST);
  await db
    .insert(operatorCredentialTable)
    .values({ operatorId, passwordHash })
    .onConflictDoUpdate({
      target: operatorCredentialTable.operatorId,
      set: { passwordHash, updatedAt: new Date() },
    });
}
