-- The vestigial column stops being required.
--
-- `0013` moved the credential to its own table and kept this column so the
-- deploy could not strand the running code. A new operator no longer writes it,
-- so it has to be nullable — and the next migration drops it once this is live.
--
-- Deliberately two steps rather than one. Migrations run before the build, so
-- for a few seconds the previous deploy is serving against the new schema.
ALTER TABLE "operator" ALTER COLUMN "password_hash" DROP NOT NULL;