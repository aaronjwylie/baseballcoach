/**
 * The storage spelling of the operator roles.
 *
 * **Derived** from `ROLES` in `./operator.ts`. Customers never get a row here at all.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { ROLES } from "./operator";

export const operatorRole = pgEnum("operator_role", ROLES);
