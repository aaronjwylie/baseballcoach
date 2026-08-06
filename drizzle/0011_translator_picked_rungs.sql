-- Picking a translator is its own rung, on both legs — the last of the four
-- asymmetries between how a coach and a translator are handled.
--
-- The coach ladder spends a rung on "chosen, not yet sent" (`assigned`),
-- because the admin picks on Monday and sends when they are ready. `0010` gave
-- translators the "emailed" and "has it" rungs but left picking folded into
-- whatever rung the submission was already sitting on, so a translator chosen
-- and not yet sent looked identical to one never chosen at all.
--
-- Twenty rungs. Eight of them are the translation branch, and a submission
-- whose coach shares the customer's language still touches twelve.
--
-- BEFORE again: the enum's order is the ladder's order, and ADD VALUE appends
-- unless told where to go.
--
-- Alone in its migration, like 0004, 0009 and 0010 — ADD VALUE commits a label
-- that cannot be *used* until that commit lands.
ALTER TYPE "public"."submission_status" ADD VALUE 'intake_translator_assigned' BEFORE 'sent_to_intake_translator';--> statement-breakpoint
ALTER TYPE "public"."submission_status" ADD VALUE 'feedback_translator_assigned' BEFORE 'sent_to_feedback_translator';
