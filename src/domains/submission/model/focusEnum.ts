/**
 * The coaching focus a submission is about.
 *
 * Two tables carry a column of it — `submissions.focus` and
 * `coaches.specialties` — but it lives here rather than on the shared floor
 * because **`shared/` is for things still true if the domain changes**, and
 * "Hitting · Pitching" is this business and nothing else. `coachesTable.ts`
 * imports it across, the same way it imports `usersTable`.
 *
 * Submission owns it because submission already did: `FOCUS_OPTIONS` and
 * `type Focus` are declared in `./submission.ts`, and `coach` has always read
 * them from there. One home per fact — this is the storage spelling of that
 * same fact, so it belongs beside it.
 *
 * PascalCase values match that domain union exactly.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const focus = pgEnum("focus", [
  "Hitting",
  "Pitching",
  "Fielding",
  "Catching",
  "Other",
]);
