/**
 * Who owes us what on a submission — **an assignment is a promise to produce a
 * file** (ADR 018).
 *
 * That framing is what makes the row simple. There is no `role` column, because
 * the operator already carries their role and a second copy would be a second
 * home for a fact. There is no nullable discriminator either: the first draft
 * had one — a `leg` meaningful only for translators — and it disappeared once
 * the question changed from *what extra fact does an assignment need* to *what
 * is this row for*. A stubborn nullable column usually means the row is
 * modelling the wrong noun.
 *
 * ```
 * coach                →  produces "feedback"
 * intake translator    →  produces "intake_translation"
 * feedback translator  →  produces "feedback_translation"
 * ```
 *
 * The fourth kind, `intake`, is the one nobody is assigned to produce — the
 * customer supplies it. The shape shows that asymmetry rather than hiding it.
 *
 * **Replaces `submission.assignedCoachId`**, which was one column and could not
 * hold two. A submission can carry two translators, since the return leg may go
 * to someone else, and the trail is built around one row per assignment with the
 * count derived rather than stored.
 *
 * **A row is deleted to unassign — there is no `unassignedAt`.** The trail keeps
 * the history; this table answers only *who has it now*, the same relationship
 * `submission.status` has to `submission_event`.
 */
import { pgTable, uuid, timestamp, index, unique } from "drizzle-orm/pg-core";
import { operatorTable } from "@/domains/operator/model/operatorTable";
import { submissionTable } from "./submissionTable";
import { fileKind } from "./fileKindEnum";

export const submissionAssignmentTable = pgTable(
  "submission_assignment",
  {
    id: uuid().defaultRandom().primaryKey(),
    submissionId: uuid()
      .notNull()
      .references(() => submissionTable.id, { onDelete: "cascade" }),
    operatorId: uuid()
      .notNull()
      .references(() => operatorTable.id, { onDelete: "cascade" }),
    /** What they owe us. See the mapping above. */
    produces: fileKind().notNull(),
    assignedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Read as "everyone on this submission" — the portal's question.
    index("submission_assignment_submission_id_idx").on(table.submissionId),
    // And "what am I working on" — the coach's and translator's own queue.
    index("submission_assignment_operator_id_idx").on(table.operatorId),
    /*
      One person per kind of output. Two translators on one submission is normal
      — one per leg — but two people owing the *same* file is a hand-off nobody
      can close, since either could upload it and neither is answerable.
    */
    unique("submission_assignment_one_per_kind").on(table.submissionId, table.produces),
  ],
);

export type SubmissionAssignmentRow = typeof submissionAssignmentTable.$inferSelect;
