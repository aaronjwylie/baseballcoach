/**
 * What's true of an operator who **does the work** — one row per coach or
 * translator, none for an admin.
 *
 * Retires the coach record (ADR 018). A coach and a translator carry identical
 * fields, so two tables would have been duplication with a delay; `role` on the
 * operator is what tells them apart. And an admin has none of these facts, so
 * rather than four permanently empty columns they simply have no row.
 *
 * **The row's presence is the meaningful part**: it says this person takes
 * assigned work and may appear on the public site. That is what an empty
 * `languages` column on one shared table could never say — it couldn't separate
 * "this is an admin" from "nobody has filled this coach in yet", and the second
 * is a live problem (CLAUDE.md §10: the translation rule does nothing until
 * someone records a coach's languages).
 *
 * `operatorId` is the primary key rather than a plain reference: one operator,
 * at most one profile, enforced rather than assumed.
 */
import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { focus } from "@/domains/submission/model/focusEnum";
import { operatorTable } from "./operatorTable";

export const operatorProfileTable = pgTable("operator_profile", {
  operatorId: uuid()
    .primaryKey()
    .references(() => operatorTable.id, { onDelete: "cascade" }),
  /*
    What they read and write. Half of the translation rule: intersected with the
    customer's languages, no overlap means the submission needs translating.

    A translator carries these for the same reason a coach does — "who covers
    this language pair?" becomes one question over one table, whatever the role.
  */
  languages: text().array().notNull().default([]),
  /** Which focuses they cover. Matches the `focus` enum on a submission. */
  specialties: focus().array().notNull().default([]),
  /*
    Storage locator for their photo, shown on the public site. Served through
    /api/coach-image/[id] since blobs are private. Null until one is uploaded.
  */
  imageUrl: text(),
  /** A short bio blurb for the public site. */
  bio: text(),
});

export type OperatorProfileRow = typeof operatorProfileTable.$inferSelect;
