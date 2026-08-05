/**
 * How far an email got.
 *
 * `sent` is all the send path can honestly claim — Resend accepted it. The rest
 * arrives later, by webhook, and is the difference between "we tried" and "it
 * reached them". A `bounced` on the verification code is the failure that used
 * to look exactly like a customer being slow.
 *
 * Owned by submission rather than by `shared/email`: it is a column on the
 * trail, and the trail is the submission's history. The email seam sends; it
 * doesn't remember.
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const emailOutcome = pgEnum("email_outcome", [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "failed",
]);
