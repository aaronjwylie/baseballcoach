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
import type { OperatorProfile, NewOperatorProfile } from "../model/operatorProfile";
import type { Role } from "../model/operator";
import type { Focus } from "@/domains/submission";
import { setOperatorPassword } from "@/domains/account";
import { createOperator } from "./operatorCredentialApi";

/** The one place two rows become one `OperatorProfile`. */
export function toProfile(
  operator: typeof operatorTable.$inferSelect,
  profile: typeof operatorProfileTable.$inferSelect,
): OperatorProfile {
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
export async function listByRole(role: Role): Promise<OperatorProfile[]> {
  const rows = await profileQuery()
    .where(eq(operatorTable.role, role))
    .orderBy(asc(operatorTable.name));
  return rows.map((r) => toProfile(r.operator, r.operator_profile));
}

/** One person, if they hold this role. Null if they don't — a coach id asked for as a translator is a miss, not a match. */
export async function getByRole(id: string, role: Role): Promise<OperatorProfile | null> {
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
export async function getAssignee(id: string): Promise<OperatorProfile | null> {
  const [row] = await profileQuery().where(eq(operatorTable.id, id)).limit(1);
  return row ? toProfile(row.operator, row.operator_profile) : null;
}

/**
 * Create someone who can be given work — a login **and** a profile.
 *
 * Lived in `coachApi.ts` until 2026-08-06, where it was the shared machinery
 * sitting inside one role's file: a translator needed the identical thing with
 * a different `role`, so `translatorApi` could only have been a wrapper around
 * a coach function. `_StructureLaw.md` §3b calls that the shape to refuse — the
 * third file, not the thin wrapper.
 *
 * **Not a transaction, deliberately.** `createOperator` may fail on a duplicate
 * email, which is the common case and must surface to the form as a caught
 * error; if it succeeds, the profile insert has nothing left to violate. A
 * transaction here would buy atomicity against a failure mode that does not
 * exist and cost the error message that does.
 */
export async function createProfiledOperator(
  role: Role,
  input: NewOperatorProfile,
): Promise<OperatorProfile> {
  const operator = await createOperator(input.email, input.password, role, input.name);
  const [profile] = await db
    .insert(operatorProfileTable)
    .values({
      operatorId: operator.id,
      specialties: input.specialties,
      languages: input.languages,
      bio: input.bio,
    })
    .returning();
  const [row] = await db
    .select()
    .from(operatorTable)
    .where(eq(operatorTable.id, operator.id))
    .limit(1);
  return toProfile(row, profile);
}

/** What may be changed about someone, across both of their rows. */
export interface OperatorProfilePatch {
  name?: string;
  /** The login email, on the operator row. */
  email?: string;
  /** A new login password. Omit to leave it unchanged. */
  password?: string;
  /** Storage locator for their photo. */
  imageUrl?: string;
  /** Public bio blurb. */
  bio?: string;
  specialties?: Focus[];
  languages?: string[];
  isActive?: boolean;
}

/**
 * Patch someone, across both rows.
 *
 * Split by *which of the two facts* it changes: who they are (name, email,
 * whether they may sign in) against what they cover (languages, specialties,
 * and the public page). The caller says which role it expects back, so asking
 * for a coach by a translator's id is a miss rather than a surprise.
 */
export async function updateProfiledOperator(
  id: string,
  role: Role,
  patch: OperatorProfilePatch,
): Promise<OperatorProfile> {
  const { email, password, name, isActive, ...profile } = patch;

  const operatorPatch = {
    ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
    ...(name !== undefined ? { name } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  };

  // A unique-constraint violation on the email surfaces to the action as a
  // caught error, which is why this is not wrapped here.
  if (Object.keys(operatorPatch).length) {
    await db.update(operatorTable).set(operatorPatch).where(eq(operatorTable.id, id));
  }
  if (Object.keys(profile).length) {
    await db
      .update(operatorProfileTable)
      .set(profile)
      .where(eq(operatorProfileTable.operatorId, id));
  }

  // An admin reset — no current-password check; the admin's authority is the guard.
  if (password) await setOperatorPassword(id, password);

  const updated = await getByRole(id, role);
  if (!updated) throw new Error(`${role} ${id} vanished mid-update`);
  return updated;
}
