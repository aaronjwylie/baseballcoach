/**
 * Operator identity — **operators only, never customers**.
 *
 * A row here is a login. The first `admin` is seeded (`npm run db:seed`);
 * coaches are created from the admin portal, each paired with a `coaches` row.
 * There is no self-signup and no customer-facing auth at all.
 */
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { userRole } from "./userRoleEnum";

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: userRole().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export type UserRow = typeof users.$inferSelect;
