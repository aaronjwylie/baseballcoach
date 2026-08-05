/**
 * The storage spelling of which language set someone was sent.
 *
 * **Derived** from `FILE_SETS` in `./submissionFile.ts`.
 *
 * Recorded at the moment of sending, on both hand-offs — to the coach at step 8
 * and to the customer at step 13. A property of the *send*, not of the files: it
 * answers "what did we actually give them", which can't be re-derived later from
 * whatever happens to exist by then.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { FILE_SETS } from "./submissionFile";

export const fileSet = pgEnum("file_set", FILE_SETS);
