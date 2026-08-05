/**
 * The storage spelling of what an entry in the trail records.
 *
 * **Derived** from `SUBMISSION_EVENT_KINDS` in `./submissionEvent.ts`, which is
 * the vocabulary and carries why each kind exists.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { SUBMISSION_EVENT_KINDS } from "./submissionEvent";

export const submissionEventKind = pgEnum(
  "submission_event_kind",
  SUBMISSION_EVENT_KINDS,
);
