/**
 * The two acts that need a person **and** a secret: signing in, and minting a
 * login.
 *
 * They compose here because this domain can reach both — the credential is its
 * own, and the operator row is reached at the **declaration plane**, which is
 * how a table is reached uniformly whoever is asking (`_StructureLaw` §5.7).
 *
 * That is what keeps the graph one-way. Going through `operator`'s barrel
 * instead would make `account` depend on it, and `operator` already depends on
 * this — for `requireRole`, and for the password it sets when an admin adds a
 * coach.
 */
import { createCredential, verifyPassword } from "./credentialApi";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { operatorTable } from "@/domains/operator/model/operatorTable";

import type { Role } from "../model/role";

/**
 * Who just authenticated — **this domain's own shape, not `operator`'s.**
 *
 * It is the same three fields as an `Operator`, and importing that type is what
 * `check:structure` caught: it would have made `account` depend on `operator`,
 * which already depends on this, and closed a cycle nothing else would have
 * seen.
 *
 * They are not the same concept anyway. `Operator` is the record — the row an
 * admin edits. This is the answer to *did this secret belong to somebody*, and
 * the two happening to line up today is not a reason to bind them together.
 */
export interface Authenticated {
  id: string;
  email: string;
  role: Role;
}

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
): Promise<Authenticated | null> {
  const [operator] = await db
    .select({
      id: operatorTable.id,
      email: operatorTable.email,
      role: operatorTable.role,
    })
    .from(operatorTable)
    .where(eq(operatorTable.email, email.trim().toLowerCase()))
    .limit(1);
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
): Promise<Authenticated> {
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
