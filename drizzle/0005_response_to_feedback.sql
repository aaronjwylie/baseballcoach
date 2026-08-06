-- `response` becomes `feedback`, in the two enums that still said otherwise.
--
-- The northstar renamed this concept on 2026-08-05 and stopped at the enum on
-- purpose, because that is a migration. ADR 018 made it a precondition rather
-- than a nicety: the assignment join stores a `file_kind`, so building it on the
-- old spelling would bake the inconsistency into a new table's *data* rather
-- than only its column names.
--
-- RENAME VALUE keeps the value's ordinal position, so `submission_status` stays
-- in ladder order and `ORDER BY status` still means "how far along". Every
-- existing row keeps pointing at the same value under its new name — no rows are
-- rewritten, and there is nothing to backfill.
ALTER TYPE "public"."file_kind" RENAME VALUE 'response' TO 'feedback';--> statement-breakpoint
ALTER TYPE "public"."file_kind" RENAME VALUE 'response_translation' TO 'feedback_translation';--> statement-breakpoint
ALTER TYPE "public"."submission_status" RENAME VALUE 'response_translating' TO 'feedback_translating';--> statement-breakpoint
ALTER TYPE "public"."submission_status" RENAME VALUE 'response_translated' TO 'feedback_translated';
