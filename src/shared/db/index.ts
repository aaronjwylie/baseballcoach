/**
 * The `shared/db` barrel — the database seam's public surface.
 *
 * Domains import `db` and the tables from here; nobody reaches into the schema
 * or client files directly.
 */
export { db } from "./client";
export {
  users,
  coaches,
  submissions,
  submissionFiles,
  submissionEvents,
  settings,
  fileKind,
  fileSet,
  focus,
  submissionStatus,
  submissionEventKind,
  userRole,
} from "./schema";
export type {
  UserRow,
  CoachRow,
  SubmissionRow,
  NewSubmissionRow,
  SubmissionFileRow,
  NewSubmissionFileRow,
  SubmissionEventRow,
  SettingsRow,
} from "./schema";
