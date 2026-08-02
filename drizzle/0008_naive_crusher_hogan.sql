-- Phase 1 of the rollout: the spine of record.
--
-- Three things, in one migration so the two vocabularies never coexist in a
-- deployed state:
--   1. the status ladder grows from 7 rungs to 16
--   2. `submission_files.kind` becomes an enum, renamed to intake/response
--   3. `submission_events` — one row per transition, the trail
--
-- Hand-corrected after generation. Drizzle emitted a bare cast for (2), which
-- fails on every existing row: the stored values are 'submission' and 'feedback',
-- neither of which is in the new enum. The rename has to happen while the column
-- is still text.

CREATE TYPE "public"."file_kind" AS ENUM('intake', 'intake_translation', 'response', 'response_translation');--> statement-breakpoint

-- The nine new rungs. Positioned so the enum's own order matches the ladder's,
-- which is what makes `ORDER BY status` mean "how far along" without a lookup.
ALTER TYPE "public"."submission_status" ADD VALUE 'intake_translating' BEFORE 'in_review';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE 'intake_translated' BEFORE 'in_review';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE 'sent_to_coach' BEFORE 'in_review';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE 'response_translating' BEFORE 'complete';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE 'response_translated' BEFORE 'complete';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE 'collected';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE 'resolved';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE 'purge_imminent';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE 'purged';--> statement-breakpoint

CREATE TABLE "submission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"status" "submission_status" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"note" text
);
--> statement-breakpoint

-- `kind`: text → enum, renaming as we go.
--
-- Order matters. The default is dropped first because a text default can't be
-- cast alongside the column, and the UPDATEs run while the column is still text
-- so they compare against the old values.
ALTER TABLE "submission_files" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
UPDATE "submission_files" SET "kind" = 'intake' WHERE "kind" = 'submission';--> statement-breakpoint
UPDATE "submission_files" SET "kind" = 'response' WHERE "kind" = 'feedback';--> statement-breakpoint
ALTER TABLE "submission_files" ALTER COLUMN "kind" SET DATA TYPE "public"."file_kind" USING "kind"::"public"."file_kind";--> statement-breakpoint
ALTER TABLE "submission_files" ALTER COLUMN "kind" SET DEFAULT 'intake';--> statement-breakpoint

ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_events_submission_id_idx" ON "submission_events" USING btree ("submission_id");
