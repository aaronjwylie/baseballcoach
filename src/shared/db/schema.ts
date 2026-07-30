/**
 * The database schema — the single home for every stored column.
 *
 * This is the Postgres system of record (CLAUDE.md §8). TypeScript keys are
 * camelCase; the `casing: "snake_case"` setting on both the client and
 * drizzle-kit maps them to snake_case columns, so the app reads camelCase and
 * the database stays idiomatic SQL. No other file spells a column name.
 *
 * Three tables: `users` (operator logins), `coaches` (the people who review),
 * and `submissions` (the spine — one row per paid request).
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
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

// The submission lifecycle. The app writes the first two; the portal drives the
// rest (CLAUDE.md §8).
export const submissionStatus = pgEnum("submission_status", [
  "awaiting_upload",
  "new",
  "assigned",
  "in_review",
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
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: uuid().defaultRandom().primaryKey(),
  customerEmail: text().notNull(),
  playerName: text().notNull(),
  playerAge: integer(),
  focus: focus(),
  customerNotes: text(),
  internalNotes: text(),
  status: submissionStatus().notNull().default("awaiting_upload"),
  // The payment-intent id; the webhook's idempotency key.
  stripePaymentId: text().unique(),
  stripeAmount: integer(), // cents
  videoUrl: text(),
  assignedCoachId: uuid().references(() => coaches.id, {
    onDelete: "set null",
  }),
  feedbackUrl: text(),
  feedbackEmailedAt: timestamp({ withTimezone: true }),
  submittedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

// Row types inferred from the tables — the domain layer builds its own shapes
// on top of these rather than importing Drizzle everywhere.
export type UserRow = typeof users.$inferSelect;
export type CoachRow = typeof coaches.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type NewSubmissionRow = typeof submissions.$inferInsert;
