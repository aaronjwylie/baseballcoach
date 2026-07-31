-- Retire the single `video_url` column in favour of the `submission_files`
-- table, and drop the `awaiting_upload` status along with it.
--
-- Hand-edited from the generated version, which would have failed twice: it
-- changed the column type while an enum-typed DEFAULT was still attached, and
-- it cast `awaiting_upload` into an enum that no longer contains it. The
-- backfill below is also ours — the generator has no way to know that a dropped
-- column's values belong in a new table.

-- Preserve whatever was already attached under the retired column. Size and
-- content type were never recorded per-file before now, so they are stored as
-- unknown rather than invented.
INSERT INTO "submission_files" ("submission_id", "filename", "content_type", "size_bytes", "file_url")
SELECT "id", 'video', 'application/octet-stream', 0, "video_url"
FROM "submissions"
WHERE "video_url" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "submissions" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint

-- Upload now happens before payment, so "paid, awaiting a file" cannot occur.
-- Any row still holding it belongs at the start of the new flow.
UPDATE "submissions" SET "status" = 'draft' WHERE "status" = 'awaiting_upload';--> statement-breakpoint

DROP TYPE "public"."submission_status";--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'awaiting_payment', 'new', 'assigned', 'in_review', 'complete');--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DATA TYPE "public"."submission_status" USING "status"::"public"."submission_status";--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."submission_status";--> statement-breakpoint

ALTER TABLE "submissions" DROP COLUMN "video_url";
