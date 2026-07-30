CREATE TYPE "public"."focus" AS ENUM('Hitting', 'Pitching', 'Fielding', 'Catching', 'Other');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('awaiting_upload', 'new', 'assigned', 'in_review', 'complete');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'coach');--> statement-breakpoint
CREATE TABLE "coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"specialties" "focus"[] DEFAULT '{}' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"status" "submission_status" DEFAULT 'awaiting_upload' NOT NULL,
	"stripe_payment_id" text,
	"stripe_amount" integer,
	"video_url" text,
	"assigned_coach_id" uuid,
	"feedback_url" text,
	"feedback_emailed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
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
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assigned_coach_id_coaches_id_fk" FOREIGN KEY ("assigned_coach_id") REFERENCES "public"."coaches"("id") ON DELETE set null ON UPDATE no action;