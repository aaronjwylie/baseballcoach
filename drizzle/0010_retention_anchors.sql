-- Phase 6 of the rollout: retention keyed on collection, not completion.
--
-- Written by hand. `drizzle-kit generate` can't tell a rename from a drop-plus-add
-- without asking, and this migration is both: `retain_resolved_hours` is replaced
-- by three settings with a different meaning, not renamed to one of them.
--
-- Two anchors join `submissions`. They duplicate facts the event trail already
-- holds, deliberately: the trail is history, these are the working values the
-- nightly sweep scans on. A scan against a join is one we'd have to justify at
-- every row.

ALTER TABLE "submissions" ADD COLUMN "collected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "deletion_warned_at" timestamp with time zone;--> statement-breakpoint

-- The sweep reads by status + one of these, every night.
CREATE INDEX "submissions_collected_at_idx" ON "submissions" USING btree ("collected_at");--> statement-breakpoint

-- Retention moves from hours-after-completion to days-after-collection, with a
-- backstop measured from delivery for the customer who never collects at all.
ALTER TABLE "settings" DROP COLUMN "retain_resolved_hours";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "retain_collected_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "retain_delivered_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "warn_before_deletion_days" integer DEFAULT 7 NOT NULL;
