/**
 * The storage spelling of the four folders.
 *
 * **Derived** from `FILE_KINDS` in `./submissionFile.ts`, which is the
 * vocabulary and also holds the side-of map that decides what each kind *means*.
 * A fifth kind added there is a compile error until that map answers for it —
 * which is a guarantee this file can't offer and shouldn't try to.
 *
 * Kinds are **nouns**, statuses are **participles** (`_NomenclatureLaw.md` §2):
 * `intake_translation` is what a file *is*, `intake_translated` is what has
 * *happened*. One stem, two axes; the counterpart is `./submissionStatusEnum.ts`.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { FILE_KINDS } from "./submissionFile";

export const fileKind = pgEnum("file_kind", FILE_KINDS);
