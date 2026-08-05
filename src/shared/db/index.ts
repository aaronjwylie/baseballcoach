/**
 * The `shared/db` barrel — the database seam's public surface.
 *
 * **One export: `db`, the connection.** The tables used to come through here
 * too; they don't any more. Each lives in the folder of the domain that owns it
 * and is imported from there directly, which is the whole point of the split —
 * and it's what keeps this floor domain-less, since a barrel re-exporting every
 * table would mean `shared/` importing every domain.
 *
 * A `*Table.ts` must not import from here. See `@/db/schema` for why.
 */
export { db } from "./client";
