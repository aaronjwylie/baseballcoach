/**
 * One row per status transition — **the trail**.
 *
 * Chosen over sixteen nullable `*At` columns on `submissions`, and it answers
 * strictly more: a column can only remember one moment, so a submission the admin
 * resets and which then reaches the same rung twice loses one of them. This
 * keeps both, in order, with who caused each.
 *
 * `submissions.status` stays as the *current* value, so every existing query is
 * unaffected — this is the history beside it, not a replacement for it.
 *
 * `actorId` is null when nobody was logged in: the customer, or the cron.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { operators } from "@/domains/operator/model/operatorsTable";
import { submissions } from "./submissionsTable";
import { submissionStatus } from "./submissionStatusEnum";
import { submissionEventKind } from "./submissionEventKindEnum";
import { emailOutcome } from "./emailOutcomeEnum";

export const submissionEvents = pgTable(
  "submission_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    submissionId: uuid()
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
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
    at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    // Null for the customer and the scheduled sweep — neither has a login.
    actorId: uuid().references(() => operators.id, { onDelete: "set null" }),
    // Why, for the operator overrides that need a reason.
    note: text(),
  },
  (table) => [
    // Read as "this submission's history, oldest first".
    index("submission_events_submission_id_idx").on(table.submissionId),
    // The delivery webhook's only handle on a submission.
    index("submission_events_message_id_idx").on(table.messageId),
  ],
);

export type SubmissionEventRow = typeof submissionEvents.$inferSelect;
