-- Translation need becomes symmetric: intersect the customer's languages with
-- the coach's, and an empty intersection means translate.
--
-- It was asymmetric before — the platform is English, therefore translate when
-- the coach doesn't read English — which works only by guessing one side.
--
-- Empty means *not declared*, deliberately, not English. A row that predates the
-- question should read as unknown rather than claim an answer it never gave.

ALTER TABLE "submissions" ADD COLUMN "languages" text[] DEFAULT '{}' NOT NULL;
