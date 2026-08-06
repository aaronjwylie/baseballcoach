/**
 * One row per file, **both directions**.
 *
 * This replaced the single `videoUrl` column on `submissionTable` when the flow
 * moved to multi-file uploads — a submission may now carry video, stills, and
 * documents together, and the receipt email lists them by name.
 *
 * `fileUrl` is the storage *locator*, matching `feedbackUrl` on the submission:
 * a local key in dev, a Blob URL in prod. It goes null when the retention sweep
 * deletes the bytes; the row survives as the record of what was sent, which is
 * why `/api/files/[id]` answers **410 Gone** rather than 404.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { submissionTable } from "./submissionTable";
import { fileKind } from "./fileKindEnum";

export const submissionFileTable = pgTable(
  "submission_file",
  {
    id: uuid().defaultRandom().primaryKey(),
    submissionId: uuid()
      .notNull()
      .references(() => submissionTable.id, { onDelete: "cascade" }),
    filename: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: integer().notNull(),
    fileUrl: text(),
    // One table, four roles, kept apart by this discriminator. See `fileKind`.
    kind: fileKind().notNull().default("intake"),
    uploadedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("submission_file_submission_id_idx").on(table.submissionId),
  ],
);

export type SubmissionFileRow = typeof submissionFileTable.$inferSelect;
export type NewSubmissionFileRow = typeof submissionFileTable.$inferInsert;
