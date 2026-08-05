/**
 * What a stored file *is* — the four folders, as one column.
 *
 * **Nouns, deliberately** (`_NomenclatureLaw.md` §2): a kind answers *what is
 * this file*, while a status answers *what has happened*. That's why the kind is
 * `intake_translation` and the status is `intake_translated` — one stem, two
 * axes, no ambiguity at the call site. Its counterpart lives next door in
 * `./submissionStatusEnum.ts`; the pairing is the point.
 *
 * `intake` = what the customer sent · `response` = what the coach wrote back.
 * Each has a translated counterpart, uploaded by the admin and stored beside the
 * original rather than replacing it.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const fileKind = pgEnum("file_kind", [
  "intake",
  "intake_translation",
  "response",
  "response_translation",
]);
