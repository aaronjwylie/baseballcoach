-- An operator's ability to sign in becomes its own table.
--
-- Two nouns were sharing a row. An operator is a person in the business; an
-- account is a capability granted to them. `role` is a business fact and
-- `password_hash` is an account fact, and one row held both — which is what
-- made authentication unable to be its own domain without reading another
-- domain's table (`_StructureLaw` §5b).
--
-- Better schema independently of folders: every `SELECT *` on an operator was
-- carrying a password hash into memory for a column almost nothing reads.
--
-- `operator_id` is the primary key rather than a separate id — one login per
-- operator, enforced by the shape instead of a unique constraint.
--
-- ── EXPAND ONLY ────────────────────────────────────────────────────────────
-- `operator.password_hash` is backfilled and **kept**. The deploy migrates
-- before it builds, so for a few seconds the old code is still serving against
-- the new schema; dropping the column here would be the 2026-08-02 outage
-- exactly. A follow-up migration contracts it once this is live.
CREATE TABLE "operator_credential" (
	"operator_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operator_credential" ADD CONSTRAINT "operator_credential_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Backfill: every operator that can sign in today keeps being able to.
INSERT INTO "operator_credential" ("operator_id", "password_hash")
SELECT "id", "password_hash" FROM "operator"
ON CONFLICT ("operator_id") DO NOTHING;
