/**
 * Coach queries + creation.
 *
 * Creating a coach makes two rows: a `users` login (via the account domain) and
 * a `coaches` profile keyed to it. The only place the app touches the `coaches`
 * table.
 */
import { asc, eq } from "drizzle-orm";
import { db, coaches } from "@/shared/db";
import { createOperator } from "@/domains/account";
import type { Focus } from "@/domains/submission";
import type { Coach, NewCoach } from "../model/coach";

function toCoach(row: typeof coaches.$inferSelect): Coach {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    specialties: row.specialties,
    languages: row.languages,
    isActive: row.isActive,
  };
}

export async function listCoaches(): Promise<Coach[]> {
  const rows = await db.select().from(coaches).orderBy(asc(coaches.name));
  return rows.map(toCoach);
}

export async function getCoachByUserId(userId: string): Promise<Coach | null> {
  const [row] = await db
    .select()
    .from(coaches)
    .where(eq(coaches.userId, userId))
    .limit(1);
  return row ? toCoach(row) : null;
}

export async function createCoach(input: NewCoach): Promise<Coach> {
  const operator = await createOperator(input.email, input.password, "coach");
  const [row] = await db
    .insert(coaches)
    .values({
      userId: operator.id,
      name: input.name,
      specialties: input.specialties,
      languages: input.languages,
    })
    .returning();
  return toCoach(row);
}

export async function getCoach(id: string): Promise<Coach | null> {
  const [row] = await db.select().from(coaches).where(eq(coaches.id, id)).limit(1);
  return row ? toCoach(row) : null;
}

export interface CoachPatch {
  name?: string;
  specialties?: Focus[];
  languages?: string[];
  isActive?: boolean;
}

export async function updateCoach(id: string, patch: CoachPatch): Promise<Coach> {
  const [row] = await db
    .update(coaches)
    .set(patch)
    .where(eq(coaches.id, id))
    .returning();
  return toCoach(row);
}
