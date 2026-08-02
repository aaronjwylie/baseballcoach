-- The trail records everything that happened, not only status transitions.
--
-- Written by hand: `drizzle-kit generate` needs a TTY to disambiguate making a
-- NOT NULL column nullable alongside new columns, and this migration is both.
--
-- Sends are best-effort (ADR 004) — a failure logs and is swallowed — so a
-- progress view built on the old trail could only ever say "the status implies
-- we tried". `ok` is what lets it say "it landed", or that it didn't.

CREATE TYPE "public"."submission_event_kind" AS ENUM('status', 'email');--> statement-breakpoint

ALTER TABLE "submission_events" ADD COLUMN "kind" "submission_event_kind" DEFAULT 'status' NOT NULL;--> statement-breakpoint
ALTER TABLE "submission_events" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "submission_events" ADD COLUMN "ok" boolean;--> statement-breakpoint

-- An email event has no rung, and giving it one would corrupt every read that
-- uses the trail to work out where a submission is.
ALTER TABLE "submission_events" ALTER COLUMN "status" DROP NOT NULL;
