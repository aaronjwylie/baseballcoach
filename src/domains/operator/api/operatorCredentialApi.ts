/**
 * The two acts that need **both** a person and a secret.
 *
 * `account` owns the secret and knows nothing but ids; `operator` owns the
 * person and knows emails and roles. Signing in and creating a login each need
 * one fact from either side, so they compose here — in `operator`, which is the
 * domain allowed to import `account`.
 *
 * **The direction is the whole design.** If `account` resolved emails itself,
 * the two domains would import each other and the graph would cycle. Keeping
 * the composition on this side means the dependency points one way, forever.
 */
import { createCredential, verifyPassword } from "@/domains/account";
import { db } from "@/shared/db";
import { operatorTable } from "../model/operatorTable";
import { findOperatorByEmail } from "./operatorApi";
import type { Operator, Role } from "../model/operator";

/**
 * Verify an email + password.
 *
 * Returns the operator, or null if **either** is wrong — deliberately one
 * answer for both, so a caller cannot turn this into a test for which addresses
 * have logins.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<Operator | null> {
  const operator = await findOperatorByEmail(email);
  if (!operator) return null;
  return (await verifyPassword(operator.id, password)) ? operator : null;
}

/**
 * Mint a login: the operator row, then the credential.
 *
 * Two rows, two domains, in that order — the credential references the
 * operator, so it cannot exist first. A failure between them leaves an operator
 * who cannot sign in, which is a **recoverable and visible** state (the admin
 * sets a password) rather than a credential pointing at nobody.
 */
export async function createOperator(
  email: string,
  password: string,
  role: Role,
  name: string,
): Promise<Operator> {
  const [row] = await db
    .insert(operatorTable)
    .values({ email: email.trim().toLowerCase(), role, name })
    .returning({
      id: operatorTable.id,
      email: operatorTable.email,
      role: operatorTable.role,
    });
  await createCredential(row.id, password);
  return row;
}
