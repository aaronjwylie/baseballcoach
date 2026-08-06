-- Singular table names across the whole schema.
--
-- A table is named for what ONE ROW is: a submission, a coach, an operator.
-- Nominal only — no data moves, no column changes shape, no id changes, so
-- every foreign key stays valid throughout.
--
-- Hand-written for the same reason as 0001: drizzle-kit cannot tell a rename
-- from a drop-plus-create without a TTY, and its non-interactive answer would
-- be DROP TABLE on all six.
--
-- Postgres cascades a table rename to NOTHING else — not constraints, not
-- indexes. Each is renamed explicitly below, or the plurals survive in the
-- places nobody opens.
ALTER TABLE "operators" RENAME TO "operator";--> statement-breakpoint
ALTER TABLE "coaches" RENAME TO "coach";--> statement-breakpoint
ALTER TABLE "settings" RENAME TO "setting";--> statement-breakpoint
ALTER TABLE "submissions" RENAME TO "submission";--> statement-breakpoint
ALTER TABLE "submission_files" RENAME TO "submission_file";--> statement-breakpoint
ALTER TABLE "submission_events" RENAME TO "submission_event";--> statement-breakpoint

-- Primary keys.
ALTER TABLE "operator" RENAME CONSTRAINT "operators_pkey" TO "operator_pkey";--> statement-breakpoint
ALTER TABLE "coach" RENAME CONSTRAINT "coaches_pkey" TO "coach_pkey";--> statement-breakpoint
ALTER TABLE "setting" RENAME CONSTRAINT "settings_pkey" TO "setting_pkey";--> statement-breakpoint
ALTER TABLE "submission" RENAME CONSTRAINT "submissions_pkey" TO "submission_pkey";--> statement-breakpoint
ALTER TABLE "submission_file" RENAME CONSTRAINT "submission_files_pkey" TO "submission_file_pkey";--> statement-breakpoint
ALTER TABLE "submission_event" RENAME CONSTRAINT "submission_events_pkey" TO "submission_event_pkey";--> statement-breakpoint

-- Unique constraints.
ALTER TABLE "operator" RENAME CONSTRAINT "operators_email_unique" TO "operator_email_unique";--> statement-breakpoint
ALTER TABLE "submission" RENAME CONSTRAINT "submissions_stripePaymentId_unique" TO "submission_stripePaymentId_unique";--> statement-breakpoint

-- Foreign keys.
ALTER TABLE "coach" RENAME CONSTRAINT "coaches_operator_id_operators_id_fk" TO "coach_operator_id_operator_id_fk";--> statement-breakpoint
ALTER TABLE "submission" RENAME CONSTRAINT "submissions_assigned_coach_id_coaches_id_fk" TO "submission_assigned_coach_id_coach_id_fk";--> statement-breakpoint
ALTER TABLE "submission_file" RENAME CONSTRAINT "submission_files_submission_id_submissions_id_fk" TO "submission_file_submission_id_submission_id_fk";--> statement-breakpoint
ALTER TABLE "submission_event" RENAME CONSTRAINT "submission_events_submission_id_submissions_id_fk" TO "submission_event_submission_id_submission_id_fk";--> statement-breakpoint
ALTER TABLE "submission_event" RENAME CONSTRAINT "submission_events_actor_id_operators_id_fk" TO "submission_event_actor_id_operator_id_fk";--> statement-breakpoint

-- Indexes.
ALTER INDEX "submissions_customer_email_idx" RENAME TO "submission_customer_email_idx";--> statement-breakpoint
ALTER INDEX "submissions_status_idx" RENAME TO "submission_status_idx";--> statement-breakpoint
ALTER INDEX "submission_files_submission_id_idx" RENAME TO "submission_file_submission_id_idx";--> statement-breakpoint
ALTER INDEX "submission_events_submission_id_idx" RENAME TO "submission_event_submission_id_idx";--> statement-breakpoint
ALTER INDEX "submission_events_message_id_idx" RENAME TO "submission_event_message_id_idx";
