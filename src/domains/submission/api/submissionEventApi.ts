/**
 * The trail — one row per status transition.
 *
 * Chosen over sixteen nullable `*At` columns on `submissions`, and it answers
 * strictly more. A column remembers one moment; this remembers every one, in
 * order, with who caused it. That matters because a status can be reached twice:
 * Yuta resets a submission from `awaiting_approval` back to `in_review`, the
 * coach redelivers, and it arrives at `awaiting_approval` again. A column would
 * silently overwrite the first visit.
 *
 * **The actor is read from the session, not passed in.** Every caller would have
 * to remember a parameter, and the one that forgets produces an anonymous event
 * that looks exactly like a legitimate one — a customer's own transition. Reading
 * it here makes the right answer the default: whoever was logged in when the
 * status moved. Null is meaningful, not missing — it means nobody was, which is
 * true of the customer's four steps and of the scheduled sweep.
 *
 * Writes are **best-effort in spirit but transactional in fact**: `record` runs
 * inside the same transaction as the update that caused it, so the trail cannot
 * disagree with `submissions.status`. If the insert fails, the transition fails
 * with it — a status change nobody can account for is worse than no change.
 */
import { asc, eq } from "drizzle-orm";
import { db, submissionEvents } from "@/shared/db";
import { readSession } from "@/shared/auth";
import type { SubmissionStatus } from "../model/submission";

/** A transaction handle, or the connection itself. */
type Db = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SubmissionEvent {
  id: string;
  submissionId: string;
  status: SubmissionStatus;
  at: string;
  /** The operator who caused it, or null for the customer and the cron. */
  actorId?: string;
  /** Why — set by the operator overrides that need a reason. */
  note?: string;
}

/**
 * Who is doing this, if anyone.
 *
 * Never throws: an event is a record of something that already happened, so a
 * broken or absent session must not turn a successful transition into a failure.
 * It just means we don't know, which is what null says.
 */
async function currentActorId(): Promise<string | null> {
  try {
    const session = await readSession<{ userId?: string }>();
    return session?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Stamp a transition. Call inside the transaction that performed it.
 *
 * `note` is for the operator overrides — a submission that moved backwards
 * without an explanation is worse than one that didn't move.
 */
export async function recordSubmissionEvent(
  tx: Db,
  submissionId: string,
  status: SubmissionStatus,
  note?: string,
): Promise<void> {
  await tx.insert(submissionEvents).values({
    submissionId,
    status,
    actorId: await currentActorId(),
    note: note ?? null,
  });
}

/** One submission's history, oldest first. */
export async function listSubmissionEvents(
  submissionId: string,
): Promise<SubmissionEvent[]> {
  const rows = await db
    .select()
    .from(submissionEvents)
    .where(eq(submissionEvents.submissionId, submissionId))
    .orderBy(asc(submissionEvents.at));

  return rows.map((row) => ({
    id: row.id,
    submissionId: row.submissionId,
    status: row.status,
    at: row.at.toISOString(),
    actorId: row.actorId ?? undefined,
    note: row.note ?? undefined,
  }));
}
