-- Assignment becomes a join: one row per promise to produce a file (ADR 018).
--
-- `submission.assigned_operator_id` is one column and cannot hold two. A
-- submission can carry two translators — the return leg may go to someone else —
-- and the trail is built around one row per assignment with the count derived
-- rather than stored.
--
-- **The old column is left in place**, exactly as `coach` was in 0003. The code
-- reads the join from here on; the column becomes vestigial and is dropped in a
-- later migration, once production has been seen to be right. That makes the
-- rollback "point the code back", not "restore a backup".
CREATE TABLE "submission_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"produces" "file_kind" NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_assignment_one_per_kind" UNIQUE("submission_id","produces")
);--> statement-breakpoint
ALTER TABLE "submission_assignment" ADD CONSTRAINT "submission_assignment_submission_id_submission_id_fk"
  FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_assignment" ADD CONSTRAINT "submission_assignment_operator_id_operator_id_fk"
  FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_assignment_submission_id_idx" ON "submission_assignment" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_assignment_operator_id_idx" ON "submission_assignment" USING btree ("operator_id");--> statement-breakpoint

-- Every existing assignment is a coach, and what a coach owes us is the feedback.
INSERT INTO "submission_assignment" ("submission_id", "operator_id", "produces")
  SELECT "id", "assigned_operator_id", 'feedback' FROM "submission"
  WHERE "assigned_operator_id" IS NOT NULL;
