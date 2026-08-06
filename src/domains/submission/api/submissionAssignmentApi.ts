/**
 * Who owes what on a submission.
 *
 * An assignment is a **promise to produce a file** (ADR 018): a coach owes the
 * `feedback`, a translator owes an `intake_translation` or a
 * `feedback_translation`. Nobody is assigned to produce the `intake` — the
 * customer supplies that.
 *
 * ## Mid-migration, deliberately
 *
 * `submission.assignedOperatorId` still exists and is still written. This is an
 * **expand/contract** step: the join is now the record, the column is a cache
 * kept in step so the ten read sites that use it keep working unchanged. A
 * follow-up flips those reads to `assigneeFor()` and drops the column, at which
 * point every write here loses its second half.
 *
 * **Both halves live in one transaction**, so the two cannot disagree — which is
 * the only thing that makes a temporary second home for a fact tolerable rather
 * than a bug waiting.
 *
 * ## No trail row here, yet
 *
 * The northstar wants `assigned — {operatorId}` and `unassigned — {operatorId}`
 * in the trail, one row each, so "who has had this" survives a reassignment.
 * That is **not** the `assigned` rung — the ladder moving is a different fact,
 * and writing both put the rung in twice, which `npm run simulate` caught
 * immediately and nothing else would have.
 *
 * A proper assignment event needs a fourth `submission_event_kind` beside
 * `status`, `email` and `verification`. That is a migration and its own change,
 * so for now the status transition is the only row written.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { submissionAssignmentTable } from "../model/submissionAssignmentTable";
import { submissionTable } from "../model/submissionTable";
import type { FileKind } from "../model/submissionFile";

export interface Assignment {
  operatorId: string;
  produces: FileKind;
  assignedAt: string;
}

/**
 * Give a piece of work to an operator, replacing whoever held it.
 *
 * Reassignment rather than refusal: the table allows one person per kind, and an
 * admin changing their mind is ordinary. The previous holder's row is deleted,
 * so this table only ever says who has it *now* — see the note above on the
 * trail row that will eventually preserve who had it before.
 */
export async function assignOperator(
  submissionId: string,
  operatorId: string,
  produces: FileKind,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(submissionAssignmentTable)
      .where(
        and(
          eq(submissionAssignmentTable.submissionId, submissionId),
          eq(submissionAssignmentTable.produces, produces),
        ),
      );
    await tx
      .insert(submissionAssignmentTable)
      .values({ submissionId, operatorId, produces });

    // The cache half. Goes away with the column.
    if (produces === "feedback") {
      await tx
        .update(submissionTable)
        .set({ assignedOperatorId: operatorId, updatedAt: new Date() })
        .where(eq(submissionTable.id, submissionId));
    }
  });
}

/** Take it back. The person still exists; they are off this piece of work. */
export async function unassignOperator(
  submissionId: string,
  produces: FileKind,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(submissionAssignmentTable)
      .where(
        and(
          eq(submissionAssignmentTable.submissionId, submissionId),
          eq(submissionAssignmentTable.produces, produces),
        ),
      );
    if (produces === "feedback") {
      await tx
        .update(submissionTable)
        .set({ assignedOperatorId: null, updatedAt: new Date() })
        .where(eq(submissionTable.id, submissionId));
    }
  });
}

/** Everyone on this submission, and what each of them owes. */
export async function listAssignments(submissionId: string): Promise<Assignment[]> {
  const rows = await db
    .select()
    .from(submissionAssignmentTable)
    .where(eq(submissionAssignmentTable.submissionId, submissionId));
  return rows.map((r) => ({
    operatorId: r.operatorId,
    produces: r.produces,
    assignedAt: r.assignedAt.toISOString(),
  }));
}

/** Who owes us this particular file, if anyone. */
export async function assigneeFor(
  submissionId: string,
  produces: FileKind,
): Promise<string | null> {
  const [row] = await db
    .select({ operatorId: submissionAssignmentTable.operatorId })
    .from(submissionAssignmentTable)
    .where(
      and(
        eq(submissionAssignmentTable.submissionId, submissionId),
        eq(submissionAssignmentTable.produces, produces),
      ),
    )
    .limit(1);
  return row?.operatorId ?? null;
}

/** What this operator currently owes, across every submission — their queue. */
export async function assignmentsFor(operatorId: string): Promise<Assignment[]> {
  const rows = await db
    .select()
    .from(submissionAssignmentTable)
    .where(eq(submissionAssignmentTable.operatorId, operatorId));
  return rows.map((r) => ({
    operatorId: r.operatorId,
    produces: r.produces,
    assignedAt: r.assignedAt.toISOString(),
  }));
}
