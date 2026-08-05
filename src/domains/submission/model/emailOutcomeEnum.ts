/**
 * The storage spelling of how far an email got.
 *
 * **Derived** from `EMAIL_OUTCOMES` in `./submissionEvent.ts`.
 *
 * Owned by submission rather than by `shared/email`: it is a column on the
 * trail, and the trail is the submission's history. The email seam sends; it
 * doesn't remember.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { EMAIL_OUTCOMES } from "./submissionEvent";

export const emailOutcome = pgEnum("email_outcome", EMAIL_OUTCOMES);
