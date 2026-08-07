-- An operator can be more than one kind of person.
--
-- `operator.role` was a single column, so being both an admin and a coach meant
-- two logins with two email addresses. That is how the need surfaced: the same
-- person could not be onboarded twice, and the second attempt failed on the
-- unique email.
--
-- A grant is a **privilege change**, which is why this is a table and not an
-- array column on `operator`. The two questions you eventually ask about a
-- privilege are *who granted it* and *when*; an array answers neither.
--
-- Named `operator_role_grant` because `operator_role` is taken — by the enum
-- that types its own `role` column. A table creates a type of its own name, so
-- the two cannot coexist.
--
-- ── EXPAND ONLY ────────────────────────────────────────────────────────────
-- `operator.role` is backfilled from and **kept**. Migrations run before the
-- build, so the previous deploy serves for a few seconds against the new
-- schema. A follow-up contracts it once this is live.
CREATE TABLE "operator_role_grant" (
	"operator_id" uuid NOT NULL,
	"role" "operator_role" NOT NULL,
	"granted_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "operator_role_grant_operator_id_role_pk" PRIMARY KEY("operator_id","role")
);
--> statement-breakpoint
ALTER TABLE "operator_role_grant" ADD CONSTRAINT "operator_role_grant_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_role_grant" ADD CONSTRAINT "operator_role_grant_granted_by_operator_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."operator"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Everyone keeps exactly the role they have today.
INSERT INTO "operator_role_grant" ("operator_id", "role")
SELECT "id", "role" FROM "operator"
ON CONFLICT ("operator_id", "role") DO NOTHING;--> statement-breakpoint

-- Every operator now carries a profile, admins included: an admin needs
-- languages recorded so the portal can show who is able to talk to whom.
--
-- This retires an invariant that was load-bearing until today — "an admin has
-- no profile row" was how `is an admin` was told apart from `is a coach whose
-- languages nobody filled in`. Multi-role kills that inference anyway: with
-- roles in their own table, presence of a profile says nothing about kind, and
-- the grants say it explicitly instead.
INSERT INTO "operator_profile" ("operator_id", "languages", "specialties")
SELECT "id", '{}', '{}' FROM "operator"
ON CONFLICT ("operator_id") DO NOTHING;
