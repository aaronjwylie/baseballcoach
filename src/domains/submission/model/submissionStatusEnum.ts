/**
 * The submission lifecycle — **the ladder**. Sixteen rungs, in order.
 *
 * Mirrors `SUBMISSION_STATUSES` in `./submission.ts`, which carries the full
 * account of what each rung means. Keep the two in step: this is the storage
 * spelling, that one is the vocabulary.
 *
 * A path with branches, not a progress bar — the four `*_translating` /
 * `*_translated` rungs are only touched when a coach needs a translation.
 *
 * `awaiting_upload` is gone: upload happens *before* payment, so a state meaning
 * "paid but no file yet" can no longer occur.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const submissionStatus = pgEnum("submission_status", [
  "draft",
  "awaiting_payment",
  "new",
  "assigned",
  "intake_translating",
  "intake_translated",
  "sent_to_coach",
  "in_review",
  "awaiting_approval",
  "response_translating",
  "response_translated",
  "complete",
  "collected",
  "resolved",
  "purge_imminent",
  "purged",
]);
