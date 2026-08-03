-- The four notices addressed to the operator were labelled with his name. They
-- are a role, not a person, and the portal calls that role Admin everywhere
-- else.
--
-- **This has to be a data change, not a string change.** A chain line's truth is
-- `facts.emails.get(label) === true`, an exact match against what the trail
-- stored. Renaming the constant alone would leave every historical submission
-- with a label nothing looks for, so each of those lines would read unmet — and
-- an unmet line holds the chain's pointer, which is precisely how a failed
-- notice hid the assign control for a day.
--
-- Scoped to the four known labels rather than a blanket replace: a customer's
-- own words end up in `note`, and a submission for a player named Yuta must not
-- be quietly rewritten.

UPDATE "submission_events" SET "label" = '② arrival → Admin'
  WHERE "label" = '② arrival → Yuta';--> statement-breakpoint
UPDATE "submission_events" SET "label" = '④ picked up → Admin'
  WHERE "label" = '④ picked up → Yuta';--> statement-breakpoint
UPDATE "submission_events" SET "label" = '⑤ response submitted → Admin + coach'
  WHERE "label" = '⑤ response submitted → Yuta + coach';--> statement-breakpoint
UPDATE "submission_events" SET "label" = '⑦ collected → Admin'
  WHERE "label" = '⑦ collected → Yuta';
