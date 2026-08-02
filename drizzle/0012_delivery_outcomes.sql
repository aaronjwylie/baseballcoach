-- Delivery tracking: what actually happened to an email, not just that we tried.
--
-- `sent` is all the send path can claim — Resend accepted it. Everything after
-- arrives by webhook seconds later, and a `bounced` on the verification code is
-- the failure that until now looked exactly like a customer being slow.
--
-- Written by hand for the same reason as 0011: drizzle-kit needs a TTY to
-- disambiguate additions alongside an existing nullable column.

CREATE TYPE "public"."email_outcome" AS ENUM('sent', 'delivered', 'bounced', 'complained', 'failed');--> statement-breakpoint

ALTER TABLE "submission_events" ADD COLUMN "outcome" "email_outcome";--> statement-breakpoint
ALTER TABLE "submission_events" ADD COLUMN "message_id" text;--> statement-breakpoint

-- Backfill what we already know: every existing email event recorded whether
-- Resend accepted it, which is exactly `sent` or `failed`.
UPDATE "submission_events" SET "outcome" = CASE WHEN "ok" THEN 'sent'::"public"."email_outcome" ELSE 'failed'::"public"."email_outcome" END WHERE "kind" = 'email';--> statement-breakpoint

-- The webhook's only handle on a submission, hit once per delivery notice.
CREATE INDEX "submission_events_message_id_idx" ON "submission_events" USING btree ("message_id");
