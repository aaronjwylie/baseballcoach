/**
 * An operator's ability to sign in — **the secret, and nothing else.**
 *
 * Split out of `operator` on 2026-08-06 (`_StructureLaw.md` §5b). The hash was a
 * column on the operator row, which meant authentication could not be its own
 * domain without reading another domain's table — and that constraint had been
 * mistaken twice for an architectural conclusion, when it was a schema decision
 * nobody had questioned.
 *
 * **Two nouns, and they were sharing a row.** An operator is a person in the
 * business; an account is a capability granted to them. `role` is a business
 * fact and `password_hash` is an account fact. A coach can exist before anyone
 * gives them a login — and now the schema can say so, because the credential
 * row is separate and can simply be absent.
 *
 * **It is also the better schema independently of folders.** Every `SELECT *` on
 * an operator used to carry a password hash into memory for a column almost
 * nothing reads.
 *
 * `operatorId` is the primary key, not a separate id: one login per operator,
 * enforced by the shape rather than by a unique constraint someone has to
 * remember. Cascade on delete — a credential with no operator is unreachable
 * and unrevokable.
 */
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { operatorTable } from "@/domains/operator/model/operatorTable";

export const operatorCredentialTable = pgTable("operator_credential", {
  operatorId: uuid()
    .primaryKey()
    .references(() => operatorTable.id, { onDelete: "cascade" }),
  passwordHash: text().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export type OperatorCredentialRow = typeof operatorCredentialTable.$inferSelect;
