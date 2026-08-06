CREATE TYPE "public"."email_outcome" AS ENUM('sent', 'delivered', 'bounced', 'complained', 'failed');--> statement-breakpoint
CREATE TYPE "public"."file_kind" AS ENUM('intake', 'intake_translation', 'response', 'response_translation');--> statement-breakpoint
CREATE TYPE "public"."file_set" AS ENUM('original', 'translation', 'both');--> statement-breakpoint
CREATE TYPE "public"."focus" AS ENUM('Hitting', 'Pitching', 'Fielding', 'Catching', 'Other');--> statement-breakpoint
CREATE TYPE "public"."submission_event_kind" AS ENUM('status', 'email', 'verification');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'awaiting_payment', 'new', 'assigned', 'intake_translating', 'intake_translated', 'sent_to_coach', 'in_review', 'awaiting_approval', 'response_translating', 'response_translated', 'complete', 'collected', 'resolved', 'purge_imminent', 'purged');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'coach');--> statement-breakpoint
CREATE TABLE "coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"specialties" "focus"[] DEFAULT '{}' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"price_cents" integer DEFAULT 8000 NOT NULL,
	"max_file_size_mb" integer DEFAULT 50 NOT NULL,
	"max_files_per_submission" integer DEFAULT 5 NOT NULL,
	"retain_collected_days" integer DEFAULT 30 NOT NULL,
	"retain_delivered_days" integer DEFAULT 90 NOT NULL,
	"warn_before_deletion_days" integer DEFAULT 7 NOT NULL,
	"retain_unpaid_hours" integer DEFAULT 24 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"kind" "submission_event_kind" DEFAULT 'status' NOT NULL,
	"status" "submission_status",
	"label" text,
	"outcome" "email_outcome",
	"message_id" text,
	"ok" boolean,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "submission_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"file_url" text,
	"kind" "file_kind" DEFAULT 'intake' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_email" text NOT NULL,
	"player_name" text NOT NULL,
	"player_age" integer,
	"focus" "focus",
	"customer_notes" text,
	"internal_notes" text,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"status" "submission_status" DEFAULT 'draft' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"verification_code_hash" text,
	"verification_expires_at" timestamp with time zone,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	"stripe_payment_id" text,
	"stripe_amount" integer,
	"paid_at" timestamp with time zone,
	"assigned_coach_id" uuid,
	"feedback_url" text,
	"feedback_emailed_at" timestamp with time zone,
	"coach_file_set" "file_set",
	"customer_file_set" "file_set",
	"collected_at" timestamp with time zone,
	"deletion_warned_at" timestamp with time zone,
	"files_purged_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_stripePaymentId_unique" UNIQUE("stripe_payment_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assigned_coach_id_coaches_id_fk" FOREIGN KEY ("assigned_coach_id") REFERENCES "public"."coaches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_events_submission_id_idx" ON "submission_events" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_events_message_id_idx" ON "submission_events" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "submission_files_submission_id_idx" ON "submission_files" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submissions_customer_email_idx" ON "submissions" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");