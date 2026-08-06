/**
 * Operator identity — **operatorTable only, never customers**.
 *
 * A row here is a login. The first `admin` is seeded (`npm run db:seed`);
 * coachTable are created from the admin portal, each paired with a `coachTable` row.
 * There is no self-signup and no customer-facing auth at all.
 */
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { operatorRole } from "./operatorRoleEnum";

export const operatorTable = pgTable("operator", {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: operatorRole().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export type OperatorRow = typeof operatorTable.$inferSelect;
