/**
 * The people who review — one row per coach.
 *
 * Paired with an `operators` row, which is the login; this table is who they are.
 * `languages` is half of the translation rule: intersected with the customer's,
 * no overlap means the submission needs translating.
 */
import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { focus } from "@/domains/submission/model/focusEnum";
import { operators } from "@/domains/operator/model/operatorsTable";

export const coaches = pgTable("coaches", {
  id: uuid().defaultRandom().primaryKey(),
  operatorId: uuid()
    .notNull()
    .references(() => operators.id, { onDelete: "cascade" }),
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

export type CoachRow = typeof coaches.$inferSelect;
