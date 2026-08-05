/**
 * Operator roles. Customers never get a user row.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "coach"]);
