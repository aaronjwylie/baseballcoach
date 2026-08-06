/**
 * Coach queries + creation.
 *
 * A coach is an **operator with a profile** (ADR 018) — the login row says who
 * they are and what role they hold, the profile row says what they cover. There
 * is no coach table any more, and `Coach.id` is the operator's id: one person,
 * one identifier, whichever way you arrived at them.
 *
 * This file is the only place those two rows are turned into a `Coach`.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { operatorTable } from "../model/operatorTable";
import { operatorProfileTable } from "../model/operatorProfileTable";
import { listAdminEmails } from "./operatorApi";
import { createOperator, setOperatorPassword } from "./operatorCredentialApi";
import {
  markCoachCollected,
  noteEmailSent,
  type Focus,
  isAssignedTo,
} from "@/domains/submission";
import { env } from "@/shared/config/env";
import type { Coach, NewCoach } from "../model/coach";
import type { Role } from "../model/operator";
import { sendCoachCollectedEmail } from "./coachEmail";

function toCoach(
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
 * An inner join **and** a role filter.
 *
 * The join alone was the filter once: an admin has no profile row, so with two
 * roles "has a profile" and "is a coach" were the same set. **A translator
 * broke that** — they carry languages and specialties too, so they have a
 * profile, and `listCoaches()` would have offered them in the coach dropdown.
 *
 * A shape that happens to filter correctly is not a filter; it is a
 * coincidence with a shelf life. The role is asked for explicitly now.
 */
function profileQuery(role: Role) {
  return db
    .select()
    .from(operatorTable)
    .innerJoin(
      operatorProfileTable,
      eq(operatorProfileTable.operatorId, operatorTable.id),
    )
    .where(eq(operatorTable.role, role));
}

export async function listCoaches(): Promise<Coach[]> {
  const rows = await profileQuery("coach").orderBy(asc(operatorTable.name));
  return rows.map((r) => toCoach(r.operator, r.operator_profile));
}

/**
 * The people who can be given a leg of the translation.
 *
 * Same row shape as a coach — a `Coach` is really "an operator with a profile",
 * and the two differ by role, not by fields. Sharing the type is deliberate:
 * the day they diverge is the day to split it, and not before.
 */
export async function listTranslators(): Promise<Coach[]> {
  const rows = await profileQuery("translator").orderBy(asc(operatorTable.name));
  return rows.map((r) => toCoach(r.operator, r.operator_profile));
}

export async function getCoach(id: string): Promise<Coach | null> {
  const [row] = await profileRow(id, "coach");
  return row ? toCoach(row.operator, row.operator_profile) : null;
}

/** One person with a profile, whatever their role — the assignee lookup. */
export async function getAssignee(id: string): Promise<Coach | null> {
  const [row] = await db
    .select()
    .from(operatorTable)
    .innerJoin(
      operatorProfileTable,
      eq(operatorProfileTable.operatorId, operatorTable.id),
    )
    .where(eq(operatorTable.id, id))
    .limit(1);
  return row ? toCoach(row.operator, row.operator_profile) : null;
}

function profileRow(id: string, role: Role) {
  return db
    .select()
    .from(operatorTable)
    .innerJoin(
      operatorProfileTable,
      eq(operatorProfileTable.operatorId, operatorTable.id),
    )
    .where(and(eq(operatorTable.id, id), eq(operatorTable.role, role)))
    .limit(1);
}

/**
 * Kept for the callers that hold a session's operator id.
 *
 * It is the same lookup now — `Coach.id` *is* the operator id — but the name
 * still says which id the caller has in hand, which is worth more than removing
 * one line.
 */
export function getCoachByOperatorId(operatorId: string): Promise<Coach | null> {
  return getCoach(operatorId);
}

export async function createCoach(input: NewCoach): Promise<Coach> {
  const operator = await createOperator(
    input.email,
    input.password,
    "coach",
    input.name,
  );
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
  return toCoach(row, profile);
}

export interface CoachPatch {
  name?: string;
  /** The login email, on the operator row. */
  email?: string;
  /** A new login password. Omit to leave it unchanged. */
  password?: string;
  /** Storage locator for the coach's photo. */
  imageUrl?: string;
  /** Public bio blurb. */
  bio?: string;
  specialties?: Focus[];
  languages?: string[];
  isActive?: boolean;
}

/**
 * A patch now lands on two rows, so it's split by *which* of the two facts it
 * changes: who they are (name, email, whether they may sign in) against what
 * they cover (languages, specialties, and the public page).
 */
export async function updateCoach(id: string, patch: CoachPatch): Promise<Coach> {
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

  const coach = await getCoach(id);
  if (!coach) throw new Error(`coach ${id} vanished mid-update`);
  return coach;
}

/**
 * Step 9 — the coach has collected the intake. Stamp it and tell the admin.
 *
 * **The submission must be this coach's**, not merely any coach's: the download
 * route can only see that *a* coach is logged in, and someone opening a
 * colleague's work must not close a hand-off they aren't part of.
 *
 * Idempotent via `markCoachCollected`, which only moves a submission we actually
 * sent — so a re-download does nothing and the email fires exactly once.
 *
 * Swallows its own failures. It is called without awaiting, from a route whose
 * real job is delivering bytes; a rejected promise there would be an unhandled
 * one, and a notification is never worth a failed download.
 */
export async function noteCoachCollected(
  submissionId: string,
  operatorId: string,
): Promise<void> {
  try {
    if (!(await isAssignedTo(submissionId, operatorId, "feedback"))) return;

    const coach = await getCoachByOperatorId(operatorId);
    if (!coach) return;

    const collected = await markCoachCollected(submissionId);
    if (!collected) return;

    const result = await sendCoachCollectedEmail({
      to: await listAdminEmails(),
      coachName: coach.name,
      playerName: collected.playerName,
      submissionUrl: `${env.siteUrl}/admin`,
    });
    void noteEmailSent(submissionId, "④ picked up → Admin", result);
  } catch (err) {
    console.error("[coach] recording a collection failed:", err);
  }
}
