-- The generated `ALTER TYPE ... ADD VALUE` pair was removed by hand: Postgres
-- forbids using a newly-added enum value inside the transaction that added it,
-- and 0002 recreates the type wholesale anyway. The status default moves there
-- with it, for the same reason.
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"max_file_size_mb" integer DEFAULT 50 NOT NULL,
	"max_files_per_submission" integer DEFAULT 5 NOT NULL,
	"retain_resolved_hours" integer DEFAULT 24 NOT NULL,
	"retain_unpaid_hours" integer DEFAULT 24 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"file_url" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "verification_code_hash" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "verification_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "verification_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "files_purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_files_submission_id_idx" ON "submission_files" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submissions_customer_email_idx" ON "submissions" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");