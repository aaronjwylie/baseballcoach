CREATE TYPE "public"."file_set" AS ENUM('original', 'translation', 'both');--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "coach_file_set" "file_set";--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "customer_file_set" "file_set";