/**
 * The storage spelling of **the ladder** — sixteen rungs, in order.
 *
 * **Derived, not restated.** `SUBMISSION_STATUSES` in `./submission.ts` is the
 * one ordered list of rungs, and carries the full account of what each means,
 * who moves it, and which email fires. This file only tells Postgres about it.
 *
 * It was two hand-maintained copies kept in step by a comment. They never
 * actually diverged, but nothing would have said so if they had: a rung added
 * here and not there is a valid enum with a missing value, and a rung added
 * there and not here fails at runtime on the first insert, in whichever
 * environment ran that path first.
 *
 * The enum's order is the ladder's order, so `ORDER BY status` means "how far
 * along" without a lookup. Reordering `SUBMISSION_STATUSES` therefore reorders
 * the Postgres type, which is a migration — the array is not a free list.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { SUBMISSION_STATUSES } from "./submission";

export const submissionStatus = pgEnum("submission_status", SUBMISSION_STATUSES);
