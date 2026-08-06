/**
 * Coach queries + creation.
 *
 * Creating a coach makes two rows: an `operators` login (via the operator domain) and
 * a `coaches` profile keyed to it. The only place the app touches the `coaches`
 * table.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { operators } from "@/domains/operator/model/operatorsTable";
import { coaches } from "../model/coachesTable";
import {
  createOperator,
  listAdminEmails,
  setUserPassword,
} from "@/domains/operator";
import {
  getSubmission,
  markCoachCollected,
  noteEmailSent,
  type Focus,
} from "@/domains/submission";
import { env } from "@/shared/config/env";
import type { Coach, NewCoach } from "../model/coach";
import { sendCoachCollectedEmail } from "./coachEmail";

// The email is the coach's login, so it lives on the joined `operators` row, not
// on `coaches` — one home per fact.
function toCoach(row: typeof coaches.$inferSelect, email: string): Coach {
  return {
    id: row.id,
    operatorId: row.operatorId,
    email,
    name: row.name,
    specialties: row.specialties,
    languages: row.languages,
    isActive: row.isActive,
    imageUrl: row.imageUrl ?? undefined,
    bio: row.bio ?? undefined,
  };
}

export async function listCoaches(): Promise<Coach[]> {
  const rows = await db
    .select()
    .from(coaches)
    .innerJoin(operators, eq(coaches.operatorId, operators.id))
    .orderBy(asc(coaches.name));
  return rows.map((r) => toCoach(r.coaches, r.operators.email));
}

export async function getCoachByUserId(operatorId: string): Promise<Coach | null> {
  const [row] = await db
    .select()
    .from(coaches)
    .innerJoin(operators, eq(coaches.operatorId, operators.id))
    .where(eq(coaches.operatorId, operatorId))
    .limit(1);
  return row ? toCoach(row.coaches, row.operators.email) : null;
}

export async function createCoach(input: NewCoach): Promise<Coach> {
  const operator = await createOperator(input.email, input.password, "coach");
  const [row] = await db
    .insert(coaches)
    .values({
      operatorId: operator.id,
      name: input.name,
      specialties: input.specialties,
      languages: input.languages,
      bio: input.bio,
    })
    .returning();
  return toCoach(row, operator.email);
}

export async function getCoach(id: string): Promise<Coach | null> {
  const [row] = await db
    .select()
    .from(coaches)
    .innerJoin(operators, eq(coaches.operatorId, operators.id))
    .where(eq(coaches.id, id))
    .limit(1);
  return row ? toCoach(row.coaches, row.operators.email) : null;
}

export interface CoachPatch {
  name?: string;
  /** The login email, updated on the `operators` row. */
  email?: string;
  /** A new login password, set on the `operators` row. Omit to leave it unchanged. */
  password?: string;
  /** Storage locator for the coach's photo. */
  imageUrl?: string;
  /** Public bio blurb. */
  bio?: string;
  specialties?: Focus[];
  languages?: string[];
  isActive?: boolean;
}

export async function updateCoach(id: string, patch: CoachPatch): Promise<Coach> {
  const { email, password, ...profile } = patch;

  // The profile fields live on `coaches`; only touch it if any were given.
  const [row] = Object.keys(profile).length
    ? await db.update(coaches).set(profile).where(eq(coaches.id, id)).returning()
    : await db.select().from(coaches).where(eq(coaches.id, id)).limit(1);

  // The email is the login — update it on the `operators` row (a unique-constraint
  // violation surfaces to the action as a caught error).
  let currentEmail: string;
  if (email !== undefined) {
    const [u] = await db
      .update(operators)
      .set({ email: email.trim().toLowerCase() })
      .where(eq(operators.id, row.operatorId))
      .returning({ email: operators.email });
    currentEmail = u.email;
  } else {
    const [u] = await db
      .select({ email: operators.email })
      .from(operators)
      .where(eq(operators.id, row.operatorId))
      .limit(1);
    currentEmail = u.email;
  }

  // An admin reset — no current-password check; the admin's authority is the guard.
  if (password) await setUserPassword(row.operatorId, password);

  return toCoach(row, currentEmail);
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
    const submission = await getSubmission(submissionId);
    if (!submission?.assignedCoachId) return;

    const coach = await getCoachByUserId(operatorId);
    if (!coach || coach.id !== submission.assignedCoachId) return;

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
