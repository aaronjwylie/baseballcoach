/**
 * The spine — one row per request, and the row every other domain orbits.
 *
 * Created at step 1 of the flow, before verification, files, or payment
 * (ADR 009). Before `new` it is a scratch pad the customer can abandon; after
 * it, a record.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { operatorTable } from "@/domains/operator/model/operatorTable";
import { focus } from "./focusEnum";
import { submissionStatus } from "./submissionStatusEnum";
import { fileSet } from "./fileSetEnum";

export const submissionTable = pgTable(
  "submission",
  {
    id: uuid().defaultRandom().primaryKey(),
    customerEmail: text().notNull(),
    playerName: text().notNull(),
    playerAge: integer(),
    focus: focus(),
    customerNotes: text(),
    internalNotes: text(),
    /*
      What the customer reads, so translation need can be *derived* rather than
      assumed.

      It was assumed: the platform is English, therefore translate when the coach
      doesn't read English. That only works because it guessed one side. Holding
      both sets makes the rule symmetric — **no overlap means translate** — and
      handles the case the assumption can't: a Japanese-speaking parent sending to
      a Japanese coach, where the old rule derived nothing useful.

      Empty means *not declared*, not English. A row that predates the question
      should read as unknown rather than claim an answer it never gave.
    */
    languages: text().array().notNull().default([]),
    status: submissionStatus().notNull().default("draft"),

    // Email verification — the gate on uploading, since there is no payment yet
    // to gate on. The code itself is never stored, only its bcrypt hash.
    emailVerifiedAt: timestamp({ withTimezone: true }),
    verificationCodeHash: text(),
    verificationExpiresAt: timestamp({ withTimezone: true }),
    verificationAttempts: integer().notNull().default(0),

    // The payment-intent id; the webhook's idempotency key.
    stripePaymentId: text().unique(),
    stripeAmount: integer(), // cents
    paidAt: timestamp({ withTimezone: true }),

    /*
      Who the admin gave it to. Points at an operator now, not a coach record —
      the coach record is retiring (ADR 018), and phase 3 replaces this single
      column with a join, since a submission can carry two translators.
    */
    assignedOperatorId: uuid().references(() => operatorTable.id, {
      onDelete: "set null",
    }),
    feedbackUrl: text(),
    feedbackEmailedAt: timestamp({ withTimezone: true }),

    // What each side was actually sent — null until that hand-off happens.
    coachFileSet: fileSet(),
    customerFileSet: fileSet(),

    /*
      When the customer first collected their feedback — **the retention clock's
      anchor**, and the reason it can only be set once.

      Duplicated from `submission_events`, deliberately. The trail is the
      history; this is the working value, the same relationship `status` has to
      its own events. The nightly sweep scans for everything due, and a scan
      against a join is a scan we'd have to justify at every row.
    */
    collectedAt: timestamp({ withTimezone: true }),

    /*
      When the "your files will be deleted" warning was sent.

      Its own stamp because the warning is the one genuinely *scheduled* effect
      in the system: unlike "delete what's due", "warn a week out" isn't
      derivable from a state, so nothing but this column stops it sending again
      every night for seven nights.
    */
    deletionWarnedAt: timestamp({ withTimezone: true }),

    // When the retention sweep removed the submission's files. The rows in
    // `submissionFileTable` stay, so the portal still shows what was sent; only the
    // bytes are gone.
    filesPurgedAt: timestamp({ withTimezone: true }),

    submittedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    // When the admin archived a completed submission out of the active queue. Null
    // means live; a timestamp moves it to the Archived view and out of "All".
    archivedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // The status lookup reads by email; the sweep reads by status + timestamp.
    index("submission_customer_email_idx").on(table.customerEmail),
    index("submission_status_idx").on(table.status),
  ],
);

export type SubmissionRow = typeof submissionTable.$inferSelect;
export type NewSubmissionRow = typeof submissionTable.$inferInsert;
