-- The trail records status moves and sends. It does not record the one thing a
-- customer actually *does* between them: entering the code.
--
-- A successful verification was visible only as its side effect — the rung
-- moving to `awaiting_payment` — and a **failed** one was invisible entirely.
-- That's the gap that matters. Four wrong guesses and a customer who never
-- received the code look identical from the outside, and they need opposite
-- responses: resend it, or read it back to them.
--
-- Hand-edited from the generated `ALTER TYPE ... ADD VALUE`, which isn't safe
-- inside drizzle-kit migrate's transaction — the same round-trip through `text`
-- that 0004 used. No row holds the new value yet, so it's a no-op for data.

ALTER TABLE "submission_events" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "submission_events" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."submission_event_kind";--> statement-breakpoint
CREATE TYPE "public"."submission_event_kind" AS ENUM('status', 'email', 'verification');--> statement-breakpoint
ALTER TABLE "submission_events" ALTER COLUMN "kind" SET DATA TYPE "public"."submission_event_kind" USING "kind"::"public"."submission_event_kind";--> statement-breakpoint
ALTER TABLE "submission_events" ALTER COLUMN "kind" SET DEFAULT 'status';
