-- The vestigial role column stops being required.
--
-- `0015` moved the record to `operator_role_grant` and kept this column so the
-- running deploy could not be stranded mid-migration. A new operator no longer
-- writes it, so it has to be nullable — and a later migration drops it once
-- this is live.
ALTER TABLE "operator" ALTER COLUMN "role" DROP NOT NULL;