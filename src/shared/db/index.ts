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
  settings,
  focus,
  submissionStatus,
  userRole,
} from "./schema";
export type {
  UserRow,
  CoachRow,
  SubmissionRow,
  NewSubmissionRow,
  SubmissionFileRow,
  NewSubmissionFileRow,
  SettingsRow,
} from "./schema";
