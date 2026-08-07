/**
 * Which kinds an operator is, and changing them.
 *
 * The single `operator.role` column is vestigial as of 2026-08-07; these grants
 * are the record. Everything that used to ask *what role is this person* now
 * asks *which roles do they hold*, and gets a set.
 *
 * ## A set, not a rank
 *
 * Holding `admin` does not imply holding `coach`. They are independent
 * memberships, and nothing here treats one as containing another — an admin who
 * has not been made a coach cannot be assigned a submission, which is correct:
 * running the platform and reviewing footage are different jobs that happen to
 * be done by the same person here.
 *
 * The one place order matters is **which portal you land in**, and that lives
 * with the portal chooser rather than here, because it is a UI preference
 * rather than a fact about the grants.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { operatorRoleGrantTable } from "../model/operatorRoleGrantTable";
import { operatorTable } from "../model/operatorTable";
import type { Role } from "../model/operatorRoleEnum";

/** Every kind this operator is. Empty means onboarded but given nothing yet. */
export async function rolesFor(operatorId: string): Promise<Role[]> {
  const rows = await db
    .select({ role: operatorRoleGrantTable.role })
    .from(operatorRoleGrantTable)
    .where(eq(operatorRoleGrantTable.operatorId, operatorId));
  return rows.map((r) => r.role);
}

/**
 * The same question for a page full of people — one query, not one per row.
 *
 * Returns an entry for **every** id asked about, empty array included, so a
 * caller never has to tell "no roles" from "not loaded".
 */
export async function rolesForMany(
  operatorIds: string[],
): Promise<Map<string, Role[]>> {
  const byId = new Map<string, Role[]>(operatorIds.map((id) => [id, []]));
  if (!operatorIds.length) return byId;

  const rows = await db
    .select()
    .from(operatorRoleGrantTable)
    .where(inArray(operatorRoleGrantTable.operatorId, operatorIds));
  for (const row of rows) byId.get(row.operatorId)?.push(row.role);
  return byId;
}

/**
 * Make someone a kind of operator.
 *
 * Idempotent — granting a role twice is a no-op rather than an error, because
 * the caller is a toggle and a double-click is not a mistake worth surfacing.
 * `grantedBy` is recorded on the first grant and left alone afterwards, so the
 * row keeps saying who actually made the decision.
 */
export async function grantRole(
  operatorId: string,
  role: Role,
  grantedBy: string | null,
): Promise<void> {
  await db
    .insert(operatorRoleGrantTable)
    .values({ operatorId, role, grantedBy })
    .onConflictDoNothing();
}

/**
 * Take a kind away.
 *
 * The person and their profile survive — this removes a membership, not an
 * operator. Their history on submissions survives too: `submission_assignment`
 * points at the operator, not at the role, so revoking `coach` does not erase
 * the reviews they did.
 */
export async function revokeRole(operatorId: string, role: Role): Promise<void> {
  await db
    .delete(operatorRoleGrantTable)
    .where(
      and(
        eq(operatorRoleGrantTable.operatorId, operatorId),
        eq(operatorRoleGrantTable.role, role),
      ),
    );
}

/**
 * Set someone's kinds to exactly this list — what the toggles submit.
 *
 * Diffed rather than deleted-and-reinserted, so a role that was already held
 * keeps its original `grantedAt` and `grantedBy`. Rewriting the row would
 * silently restate every existing grant as having happened just now, by
 * whoever last opened the form.
 */
export async function setRoles(
  operatorId: string,
  roles: Role[],
  grantedBy: string | null,
): Promise<void> {
  const wanted = new Set(roles);
  const held = new Set(await rolesFor(operatorId));

  await db.transaction(async (tx) => {
    for (const role of wanted) {
      if (held.has(role)) continue;
      await tx
        .insert(operatorRoleGrantTable)
        .values({ operatorId, role, grantedBy })
        .onConflictDoNothing();
    }
    for (const role of held) {
      if (wanted.has(role)) continue;
      await tx
        .delete(operatorRoleGrantTable)
        .where(
          and(
            eq(operatorRoleGrantTable.operatorId, operatorId),
            eq(operatorRoleGrantTable.role, role),
          ),
        );
    }
  });
}

/**
 * Is this operator that kind?
 *
 * The guard behind assignment and the portals, asked one operator at a time.
 */
export async function holdsRole(operatorId: string, role: Role): Promise<boolean> {
  const [row] = await db
    .select({ role: operatorRoleGrantTable.role })
    .from(operatorRoleGrantTable)
    .where(
      and(
        eq(operatorRoleGrantTable.operatorId, operatorId),
        eq(operatorRoleGrantTable.role, role),
      ),
    )
    .limit(1);
  return !!row;
}

/** Every operator id holding a kind — the join behind "list all coaches". */
export async function operatorIdsWithRole(role: Role): Promise<string[]> {
  const rows = await db
    .select({ operatorId: operatorRoleGrantTable.operatorId })
    .from(operatorRoleGrantTable)
    .innerJoin(
      operatorTable,
      eq(operatorTable.id, operatorRoleGrantTable.operatorId),
    )
    .where(eq(operatorRoleGrantTable.role, role));
  return rows.map((r) => r.operatorId);
}
