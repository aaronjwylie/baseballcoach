-- Split identity: `operator` is who logs in, `operator_profile` is who does the
-- work. Retires the coach record (ADR 018).
--
-- **This one moves data**, unlike 0001 and 0002. The `coach` table is left
-- completely intact — not one column dropped — so a bad outcome is recoverable
-- by pointing the code back at it rather than by restoring a backup. A later
-- migration drops it, once production has been seen to be right.
--
-- Hand-written like its predecessors: drizzle-kit needs a TTY to ask about a
-- rename, and it cannot express a backfill at all.

-- 1 · Everyone who logs in has a name and may be switched off.
ALTER TABLE "operator" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "operator" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint

-- Coaches have both already; take them.
UPDATE "operator" o SET "name" = c."name", "is_active" = c."is_active"
  FROM "coach" c WHERE c."operator_id" = o."id";--> statement-breakpoint

-- Admins never had a name — nothing recorded one. The local part of the email is
-- the only true thing available, and the admin can correct it in the portal.
-- Better a wrong-ish name they can fix than a NOT NULL that refuses to apply.
UPDATE "operator" SET "name" = split_part("email", '@', 1) WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "operator" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint

-- 2 · The profile: one row per coach or translator, none for an admin.
CREATE TABLE "operator_profile" (
	"operator_id" uuid PRIMARY KEY NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"specialties" "focus"[] DEFAULT '{}' NOT NULL,
	"image_url" text,
	"bio" text
);--> statement-breakpoint
ALTER TABLE "operator_profile" ADD CONSTRAINT "operator_profile_operator_id_operator_id_fk"
  FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

INSERT INTO "operator_profile" ("operator_id", "languages", "specialties", "image_url", "bio")
  SELECT "operator_id", "languages", "specialties", "image_url", "bio" FROM "coach";--> statement-breakpoint

-- 3 · A submission is assigned to an operator, not to a coach record.
--
-- The foreign key must go before the values change: mid-update they are coach
-- ids being rewritten to operator ids, and the old constraint would reject
-- every row.
ALTER TABLE "submission" RENAME COLUMN "assigned_coach_id" TO "assigned_operator_id";--> statement-breakpoint
ALTER TABLE "submission" DROP CONSTRAINT "submission_assigned_coach_id_coach_id_fk";--> statement-breakpoint
UPDATE "submission" s SET "assigned_operator_id" = c."operator_id"
  FROM "coach" c WHERE s."assigned_operator_id" = c."id";--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_assigned_operator_id_operator_id_fk"
  FOREIGN KEY ("assigned_operator_id") REFERENCES "public"."operator"("id") ON DELETE set null ON UPDATE no action;
