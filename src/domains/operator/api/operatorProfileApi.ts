/**
 * The machinery shared by everyone who *does the work* — coaches and
 * translators alike.
 *
 * An operator with a profile row is someone the admin can hand a submission to.
 * The admin has no profile, which is what keeps them out of every list here.
 * Coach and translator differ by **role**, not by shape: same two rows, same
 * fields, same query. So the query lives once, here, and the two callers pass
 * their role.
 *
 * ## Why the role filter is explicit
 *
 * The join alone used to be the filter — an admin has no profile, so with two
 * roles "has a profile" and "is a coach" were the same set. **A translator
 * broke that.** They carry languages and specialties too, so `listCoaches()`
 * would have offered every translator in the coach dropdown.
 *
 * A shape that happens to filter correctly is not a filter; it is a coincidence
 * with a shelf life.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { operatorTable } from "../model/operatorTable";
import { operatorProfileTable } from "../model/operatorProfileTable";
import type { Coach } from "../model/coach";
import type { Role } from "../model/operator";

/** The one place two rows become one `Coach`. */
export function toProfile(
  operator: typeof operatorTable.$inferSelect,
  profile: typeof operatorProfileTable.$inferSelect,
): Coach {
  return {
    id: operator.id,
    email: operator.email,
    name: operator.name,
    isActive: operator.isActive,
    specialties: profile.specialties,
    languages: profile.languages,
    imageUrl: profile.imageUrl ?? undefined,
    bio: profile.bio ?? undefined,
  };
}

/**
 * The join, kept private to this file.
 *
 * It reads two tables at once, which is why coaches and translators cannot be
 * separate domains however tempting the folder split looks: a join needs both
 * tables in one query, and a domain reading another's tables is the rule
 * `domains/coach` was dissolved for breaking.
 */
function profileQuery() {
  return db
    .select()
    .from(operatorTable)
    .innerJoin(
      operatorProfileTable,
      eq(operatorProfileTable.operatorId, operatorTable.id),
    );
}

/** Everyone holding one role, by name. */
export async function listByRole(role: Role): Promise<Coach[]> {
  const rows = await profileQuery()
    .where(eq(operatorTable.role, role))
    .orderBy(asc(operatorTable.name));
  return rows.map((r) => toProfile(r.operator, r.operator_profile));
}

/** One person, if they hold this role. Null if they don't — a coach id asked for as a translator is a miss, not a match. */
export async function getByRole(id: string, role: Role): Promise<Coach | null> {
  const [row] = await profileQuery()
    .where(and(eq(operatorTable.id, id), eq(operatorTable.role, role)))
    .limit(1);
  return row ? toProfile(row.operator, row.operator_profile) : null;
}

/**
 * One person with a profile, whatever their role.
 *
 * For the callers holding an id off `submission_assignment`, which stores who
 * owes a file without caring which kind of worker they are.
 */
export async function getAssignee(id: string): Promise<Coach | null> {
  const [row] = await profileQuery().where(eq(operatorTable.id, id)).limit(1);
  return row ? toProfile(row.operator, row.operator_profile) : null;
}
