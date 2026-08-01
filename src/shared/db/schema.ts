/**
 * The database schema — the single home for every stored column.
 *
 * This is the Postgres system of record (CLAUDE.md §8). TypeScript keys are
 * camelCase; the `casing: "snake_case"` setting on both the client and
 * drizzle-kit maps them to snake_case columns, so the app reads camelCase and
 * the database stays idiomatic SQL. No other file spells a column name.
 *
 * Five tables: `users` (operator logins), `coaches` (the people who review),
 * `submissions` (the spine — one row per request), `submissionFiles` (what the
 * customer uploaded, one row per file), and `settings` (the operator's knobs).
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// The coaching focus a submission is about. PascalCase values match the domain
// union used across the app.
export const focus = pgEnum("focus", [
  "Hitting",
  "Pitching",
  "Fielding",
  "Catching",
  "Other",
]);

/**
 * The submission lifecycle, in order.
 *
 * The customer flow writes the first three — `draft` when they give us player
 * details, `awaiting_payment` once their email is verified, `new` when the
 * payment clears. The portal drives the rest.
 *
 * `awaiting_upload` is gone: upload now happens *before* payment, so a state
 * meaning "paid but no file yet" can no longer occur. The migration maps the
 * rows that had it onto `draft`.
 */
export const submissionStatus = pgEnum("submission_status", [
  "draft",
  "awaiting_payment",
  "new",
  "assigned",
  "in_review",
  "awaiting_approval",
  "complete",
]);

// Operator roles. Customers never get a user row.
export const userRole = pgEnum("user_role", ["admin", "coach"]);

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: userRole().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const coaches = pgTable("coaches", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text().notNull(),
  specialties: focus().array().notNull().default([]),
  languages: text().array().notNull().default([]),
  isActive: boolean().notNull().default(true),
  // Storage locator for the coach's photo, shown on the public site. Served via
  // /api/coach-image/[id] since blobs are private. Null until one is uploaded.
  imageUrl: text(),
  // A short bio blurb for the public site.
  bio: text(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: uuid().defaultRandom().primaryKey(),
    customerEmail: text().notNull(),
    playerName: text().notNull(),
    playerAge: integer(),
    focus: focus(),
    customerNotes: text(),
    internalNotes: text(),
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

    assignedCoachId: uuid().references(() => coaches.id, {
      onDelete: "set null",
    }),
    feedbackUrl: text(),
    feedbackEmailedAt: timestamp({ withTimezone: true }),

    // When the retention sweep removed the customer's uploaded files. The rows
    // in `submissionFiles` stay, so the receipt and the portal still show what
    // was sent; only the bytes are gone.
    filesPurgedAt: timestamp({ withTimezone: true }),

    submittedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    // When Yuta archived a completed submission out of the active queue. Null
    // means live; a timestamp moves it to the Archived view and out of "All".
    archivedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // The status lookup reads by email; the sweep reads by status + timestamp.
    index("submissions_customer_email_idx").on(table.customerEmail),
    index("submissions_status_idx").on(table.status),
  ],
);

/**
 * One row per file the customer uploaded.
 *
 * This replaced the single `videoUrl` column on `submissions` when the flow
 * moved to multi-file uploads — a submission may now carry video, stills, and
 * documents together, and the receipt email lists them by name.
 *
 * `fileUrl` is the storage *locator*, matching `feedbackUrl` on the submission:
 * a local key in dev, a Blob URL in prod. It goes null when the retention sweep
 * deletes the bytes; the row survives as the record of what was sent.
 */
export const submissionFiles = pgTable(
  "submission_files",
  {
    id: uuid().defaultRandom().primaryKey(),
    submissionId: uuid()
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    filename: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: integer().notNull(),
    fileUrl: text(),
    uploadedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("submission_files_submission_id_idx").on(table.submissionId)],
);

/**
 * The operator's knobs — one row, always.
 *
 * These are limits Yuta tunes from the admin portal without a deploy, which is
 * why they're in Postgres and not in `shared/config/env.ts`: env vars are the
 * developer's configuration, these are the operator's. `id` is fixed so the
 * table cannot grow a second row.
 */
export const settings = pgTable("settings", {
  id: text().primaryKey().default("default"),
  /** What the customer pays per review, in cents. Operator-tunable. */
  priceCents: integer().notNull().default(8000),
  maxFileSizeMb: integer().notNull().default(50),
  maxFilesPerSubmission: integer().notNull().default(5),
  /** Hours after a submission completes before its uploads are deleted. */
  retainResolvedHours: integer().notNull().default(24),
  /** Hours after an unpaid submission is created before its uploads go. */
  retainUnpaidHours: integer().notNull().default(24),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

// Row types inferred from the tables — the domain layer builds its own shapes
// on top of these rather than importing Drizzle everywhere.
export type UserRow = typeof users.$inferSelect;
export type CoachRow = typeof coaches.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type NewSubmissionRow = typeof submissions.$inferInsert;
export type SubmissionFileRow = typeof submissionFiles.$inferSelect;
export type NewSubmissionFileRow = typeof submissionFiles.$inferInsert;
export type SettingsRow = typeof settings.$inferSelect;
