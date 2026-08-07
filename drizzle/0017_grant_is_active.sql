-- Being available is per kind, not per person.
--
-- Someone can be a coach who is taking submissions and a translator who is not,
-- or paused on both while still running the platform. `operator.is_active`
-- could not say that — and it said nothing at all, since nothing read it.
--
-- `operator.is_active` survives with a narrower job: whether they may sign in.
-- Suspending an account and pausing one kind of work are different decisions.
ALTER TABLE "operator_role_grant" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
-- Everyone keeps the availability they appear to have today.
UPDATE "operator_role_grant" g
SET "is_active" = o."is_active"
FROM "operator" o
WHERE o."id" = g."operator_id";
