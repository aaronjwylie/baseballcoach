-- Add `awaiting_approval` (coach has submitted their feedback; Yuta reviews it
-- before the customer is emailed) between `in_review` and `complete`.
--
-- Hand-edited from the generated `ALTER TYPE ... ADD VALUE`, which isn't safe
-- inside drizzle-kit migrate's transaction — the same reason 0001/0002 recreate
-- the type wholesale. No existing row holds the new value, so the round-trip
-- through `text` is a no-op for current data.

ALTER TABLE "submissions" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."submission_status";--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'awaiting_payment', 'new', 'assigned', 'in_review', 'awaiting_approval', 'complete');--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DATA TYPE "public"."submission_status" USING "status"::"public"."submission_status";--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."submission_status";
