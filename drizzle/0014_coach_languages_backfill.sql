-- Every coach on record predates the question, and every one of them reads
-- English — that was the platform's assumption right up until the intersection
-- rule replaced it. Say so explicitly, so the rule has both halves.
--
-- Without this, a submission assigned to a pre-existing coach reads "no
-- languages recorded for this coach": correct, and useless. The rule stays
-- inert until someone opens each profile and types the answer everyone already
-- knew.
--
-- Only blank rows are touched, so this is a no-op on any coach whose languages
-- have been set — including one deliberately set to Japanese only. Re-running it
-- cannot undo a real answer.
--
-- Unlike submissions.languages (0013), where blank is left alone on purpose:
-- that column is a customer's own declaration, and filling it in would put words
-- in their mouth. A coach's profile is Yuta's to state.

UPDATE "coaches"
SET "languages" = ARRAY['English']
WHERE "languages" IS NULL OR cardinality("languages") = 0;
