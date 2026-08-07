/**
 * Which kinds an operator is — **one row per role they hold.**
 *
 * A person is not one kind of operator. Ben runs the platform *and* coaches; a
 * coach who reads both languages is also the translator for their own
 * submissions. Until 2026-08-07 `operator.role` was a single column, so the
 * only way to be two things was two logins with two email addresses — which is
 * how the need surfaced: the same person could not be onboarded twice.
 *
 * ## Why a table rather than an array column
 *
 * `languages` and `specialties` are arrays on the profile, so an array here
 * would have been consistent and half the work. A grant is different: **it is a
 * privilege change**, and the two questions you eventually ask about one are
 * *who did this* and *when*. An array answers neither, and cannot be made to
 * without becoming a table.
 *
 * That is the whole reason for `grantedBy`. Nothing reads it yet.
 *
 * ## The shape
 *
 * The primary key is the pair, so holding a role twice is not representable —
 * the constraint does the work a `DISTINCT` would otherwise have to.
 *
 * `grantedBy` is **nullable and means something when null**: the seeded first
 * admin was granted by nobody, and a backfilled row predates the question. It
 * is `set null` on delete rather than cascade, because removing the operator
 * who granted a role must not remove the role.
 *
 * `grantedAt` uses `clock_timestamp()`, not `now()` — see
 * `submissionEventTable` for the day that distinction cost us.
 */
import { pgTable, uuid, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { operatorTable } from "./operatorTable";
import { operatorRole } from "./operatorRoleEnum";

export const operatorRoleGrantTable = pgTable(
  "operator_role_grant",
  {
    operatorId: uuid()
      .notNull()
      .references(() => operatorTable.id, { onDelete: "cascade" }),
    role: operatorRole().notNull(),
    /**
     * Available for **this kind** of work.
     *
     * Per-grant rather than per-operator, because the two are genuinely
     * independent: someone can be a coach who is taking submissions and a
     * translator who is not, or paused on both while still being an admin. A
     * single flag on the operator could not say that.
     *
     * Distinct from `operator.isActive`, which is whether they may sign in at
     * all. Suspending an account and pausing one kind of work are different
     * decisions, made for different reasons, by possibly different people.
     */
    isActive: boolean().notNull().default(true),
    grantedAt: timestamp({ withTimezone: true })
      .default(sql`clock_timestamp()`)
      .notNull(),
    /** Who granted it. Null for the seeded admin and for backfilled rows. */
    grantedBy: uuid().references(() => operatorTable.id, {
      onDelete: "set null",
    }),
  },
  (table) => [primaryKey({ columns: [table.operatorId, table.role] })],
);

export type OperatorRoleGrantRow = typeof operatorRoleGrantTable.$inferSelect;
