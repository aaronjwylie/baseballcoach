-- Rename users → operators. Nominal only: no data moves, no column changes
-- shape, and every row keeps its id, so foreign keys stay valid throughout.
--
-- Hand-written because drizzle-kit cannot tell a rename from a drop-plus-create
-- without a TTY to ask (CLAUDE.md §12), and its non-interactive guess here would
-- be DROP TABLE "users" — every operator login, deleted.
--
-- "user" was the wrong word: customers use this product constantly and never get
-- a row in this table. `operator` is the settled term (_NomenclatureLaw §3) —
-- anyone who logs in, admin or coach.
--
-- Postgres does not cascade a table rename to its constraints, so each is
-- renamed explicitly. Left alone they would keep saying "users" forever, which
-- is the half-done state that reads as nobody being sure.
ALTER TYPE "public"."user_role" RENAME TO "operator_role";--> statement-breakpoint
ALTER TABLE "users" RENAME TO "operators";--> statement-breakpoint
ALTER TABLE "coaches" RENAME COLUMN "user_id" TO "operator_id";--> statement-breakpoint
ALTER TABLE "operators" RENAME CONSTRAINT "users_pkey" TO "operators_pkey";--> statement-breakpoint
ALTER TABLE "operators" RENAME CONSTRAINT "users_email_unique" TO "operators_email_unique";--> statement-breakpoint
ALTER TABLE "coaches" RENAME CONSTRAINT "coaches_user_id_users_id_fk" TO "coaches_operator_id_operators_id_fk";--> statement-breakpoint
ALTER TABLE "submission_events" RENAME CONSTRAINT "submission_events_actor_id_users_id_fk" TO "submission_events_actor_id_operators_id_fk";
