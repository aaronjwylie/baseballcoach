/**
 * What kind of thing an entry in the trail records.
 *
 * The trail began as status transitions only, which left the one class of event
 * that **fails silently** — a send — invisible. `sendEmail` reports its outcome
 * and nothing was writing it down, so a progress view could only say "the status
 * implies we tried", never "it landed".
 *
 * `verification` closes the same gap on the customer's side. Entering the code
 * is the one thing they *do* between a send and a status move, and it was
 * visible only as its side effect — the rung advancing. A **failed** attempt
 * left no trace at all, which is the half that matters: four wrong guesses and
 * a customer who never received the code look identical from the outside, and
 * they call for opposite responses.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const submissionEventKind = pgEnum("submission_event_kind", [
  "status",
  "email",
  "verification",
]);
