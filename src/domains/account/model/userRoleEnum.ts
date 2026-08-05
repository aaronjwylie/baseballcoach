/**
 * The storage spelling of the operator roles.
 *
 * **Derived** from `ROLES` in `./user.ts`. Customers never get a user row.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { ROLES } from "./user";

export const userRole = pgEnum("user_role", ROLES);
