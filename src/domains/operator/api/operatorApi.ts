/**
 * The operator record — who exists, and which kinds they are.
 *
 * Everything about an operator **except their password**, which is not in this
 * domain at all — it lives in `account`, on its own table, behind its own
 * barrel. That started as a file boundary here and became a folder one, which
 * turns "no other file reads the stored hash" from a habit into a property you
 * can grep. A habit is what you lose first, when a function grows one
 * convenient extra field.
 *
 * Callers get an `Operator` — id, email, and every role they hold — never a
 * raw row.
 */
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { operatorTable } from "../model/operatorTable";
import { operatorRoleGrantTable } from "../model/operatorRoleGrantTable";
import { rolesFor } from "./operatorRoleApi";
import type { Operator } from "../model/operator";

/**
 * Where operator notifications go.
 *
 * Read from the table rather than an env var, deliberately: the people who
 * should hear about a payment or a stalled hand-off are exactly the people who
 * can log in and act on it, and a config value would let those two drift the
 * moment an operator changes. Distinct from `site.email` (the public address)
 * and `EMAIL_FROM` (who mail is sent *as*) — three jobs, three sources.
 *
 * Returns every admin, so a second one can be added by creating an operator
 * rather than by a deploy. Empty is survivable: the caller skips the send,
 * because nobody being told is better than a crash in a webhook.
 */
export async function listAdminEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: operatorTable.email })
    .from(operatorTable)
    .innerJoin(
      operatorRoleGrantTable,
      eq(operatorRoleGrantTable.operatorId, operatorTable.id),
    )
    .where(eq(operatorRoleGrantTable.role, "admin"));
  return rows.map((row) => row.email);
}

/**
 * Look someone up by their login address.
 *
 * Callers that use this to decide whether to send something must resolve the
 * same way either way — see `requestPasswordReset`, which returns silently on a
 * miss so that the endpoint can't be used to test which addresses have logins.
 */
export async function findOperatorByEmail(
  email: string,
): Promise<Operator | null> {
  const rows = await db
    .select({
      id: operatorTable.id,
      email: operatorTable.email,
    })
    .from(operatorTable)
    .where(eq(operatorTable.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ? { ...rows[0], roles: await rolesFor(rows[0].id) } : null;
}

export async function getOperatorById(id: string): Promise<Operator | null> {
  const rows = await db
    .select({
      id: operatorTable.id,
      email: operatorTable.email,
    })
    .from(operatorTable)
    .where(eq(operatorTable.id, id))
    .limit(1);
  return rows[0] ? { ...rows[0], roles: await rolesFor(rows[0].id) } : null;
}
