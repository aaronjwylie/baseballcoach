/**
 * The storage spelling of what the player wants coached.
 *
 * **Derived** from `FOCUS_OPTIONS` in `./submission.ts`, which is the vocabulary
 * itself. Two tables carry a column of it — `submissions.focus` and
 * `coaches.specialties` — and `coachesTable.ts` imports this across.
 *
 * It lives in this slice rather than on the shared floor because `shared/` is
 * for things still true if the domain changes, and "Hitting · Pitching" is this
 * business and nothing else. Submission owns it because submission already did.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { FOCUS_OPTIONS } from "./submission";

export const focus = pgEnum("focus", FOCUS_OPTIONS);
