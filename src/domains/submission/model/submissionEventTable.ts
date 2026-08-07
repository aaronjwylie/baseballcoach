/**
 * One row per status transition — **the trail**.
 *
 * Chosen over sixteen nullable `*At` columns on `submissionTable`, and it answers
 * strictly more: a column can only remember one moment, so a submission the admin
 * resets and which then reaches the same rung twice loses one of them. This
 * keeps both, in order, with who caused each.
 *
 * `submissionTable.status` stays as the *current* value, so every existing query is
 * unaffected — this is the history beside it, not a replacement for it.
 *
 * `actorId` is null when nobody was logged in: the customer, or the cron.
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { operatorTable } from "@/domains/operator/model/operatorTable";
import { submissionTable } from "./submissionTable";
import { submissionStatus } from "./submissionStatusEnum";
import { submissionEventKind } from "./submissionEventKindEnum";
import { emailOutcome } from "./emailOutcomeEnum";

export const submissionEventTable = pgTable(
  "submission_event",
  {
    id: uuid().defaultRandom().primaryKey(),
    submissionId: uuid()
      .notNull()
      .references(() => submissionTable.id, { onDelete: "cascade" }),
    kind: submissionEventKind().notNull().default("status"),
    /*
      The rung it moved to. **Null on an email event** — a message isn't a place
      on the ladder, and inventing one would corrupt every query that reads the
      trail to work out where a submission is.
    */
    status: submissionStatus(),
    /** Which message, on an email event: the ①–⑨ handle plus its recipient. */
    label: text(),
    /**
     * How far it got. Null on a status event.
     *
     * A send writes `sent` or `failed`; the delivery webhook appends a second
     * event carrying `delivered` or `bounced`. Two rows rather than an update,
     * because the trail is a history and overwriting "we sent it" with "it
     * bounced" loses when each was true.
     */
    outcome: emailOutcome(),
    /**
     * Resend's message id — the only thing tying a webhook back to a submission.
     *
     * Indexed, because that lookup happens on every delivery notification and is
     * the webhook's whole job.
     */
    messageId: text(),
    /**
     * Did it work?
     *
     * Only meaningful on an email event, and the reason this column exists:
     * sends are best-effort (ADR 004), so a failure is logged and swallowed. A
     * progress view that can't distinguish "sent" from "attempted" is guessing
     * about exactly the thing most likely to have gone wrong.
     */
    ok: boolean(),
    /**
     * When — and **`clock_timestamp()`, not `now()`**.
     *
     * Postgres's `now()` is the *transaction* start time: every statement in one
     * transaction sees the identical value. The trail writes more than one row
     * per transaction — a reassignment writes an `unassigned` and an `assigned`
     * together — so under `now()` those two rows were stamped identically and
     * `ORDER BY at` between them was arbitrary.
     *
     * That is not cosmetic. **The whole job of this table is what happened, in
     * what order**, and "who had this before" is unreadable if the hand-off and
     * the take-back cannot be told apart. It surfaced as a `simulate` failure
     * that reproduced once in five runs, which is the worst way for a defect to
     * announce itself.
     *
     * `clock_timestamp()` reads the actual wall clock per statement.
     */
    at: timestamp({ withTimezone: true })
      .default(sql`clock_timestamp()`)
      .notNull(),
    // Null for the customer and the scheduled sweep — neither has a login.
    actorId: uuid().references(() => operatorTable.id, { onDelete: "set null" }),
    // Why, for the operator overrides that need a reason.
    note: text(),
  },
  (table) => [
    // Read as "this submission's history, oldest first".
    index("submission_event_submission_id_idx").on(table.submissionId),
    // The delivery webhook's only handle on a submission.
    index("submission_event_message_id_idx").on(table.messageId),
  ],
);

export type SubmissionEventRow = typeof submissionEventTable.$inferSelect;
