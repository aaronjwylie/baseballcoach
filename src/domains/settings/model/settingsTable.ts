/**
 * The operator's knobs — one row, always.
 *
 * These are limits the admin tunes from the admin portal without a deploy, which is
 * why they're in Postgres and not in `shared/config/env.ts`: env vars are the
 * developer's configuration, these are the operator's (ADR 012). `id` is fixed
 * so the table cannot grow a second row.
 */
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: text().primaryKey().default("default"),
  /** What the customer pays per review, in cents. Operator-tunable. */
  priceCents: integer().notNull().default(8000),
  maxFileSizeMb: integer().notNull().default(50),
  maxFilesPerSubmission: integer().notNull().default(5),
  /** Hours after a submission completes before its uploads are deleted. */
  retainCollectedDays: integer().notNull().default(30),
  retainDeliveredDays: integer().notNull().default(90),
  warnBeforeDeletionDays: integer().notNull().default(7),
  /** Hours after an unpaid submission is created before its uploads go. */
  retainUnpaidHours: integer().notNull().default(24),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export type SettingsRow = typeof settings.$inferSelect;
