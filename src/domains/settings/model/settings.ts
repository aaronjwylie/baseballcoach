/**
 * Platform settings — the limits Yuta tunes without a deploy.
 *
 * These are deliberately **not** in `shared/config/env.ts`. Env vars are the
 * developer's configuration, set once at deploy time; these are the operator's,
 * changed from the admin portal while the site runs. Different owner, different
 * lifetime, different home.
 *
 * Knows nothing about storage — the row↔domain mapping is in
 * `api/settingsRow.ts`.
 */
import { z } from "zod";

export interface PlatformSettings {
  /** Largest single upload the customer may send, in megabytes. */
  maxFileSizeMb: number;
  /** How many files one submission may carry. */
  maxFilesPerSubmission: number;
  /** Hours after a submission completes before its uploads are deleted. */
  retainResolvedHours: number;
  /** Hours after an unpaid submission is created before its uploads go. */
  retainUnpaidHours: number;
}

/**
 * What a fresh install gets, and what the app falls back to if the settings row
 * is somehow missing. Mirrors the column defaults in the Drizzle schema — the
 * two are asserted equal by `settingsApi`'s upsert, which writes these values
 * when it creates the row.
 */
export const DEFAULT_SETTINGS: PlatformSettings = {
  maxFileSizeMb: 50,
  maxFilesPerSubmission: 5,
  retainResolvedHours: 24,
  retainUnpaidHours: 24,
};

/**
 * Bounds on the knobs themselves.
 *
 * The ceilings are not arbitrary. 2000 MB is well past any phone clip and stops
 * a typo from turning one upload into a storage bill; 20 files is past what a
 * coach can usefully review in one sitting. The retention floor of 1 hour keeps
 * an operator from setting a sweep so aggressive it deletes files out from under
 * a coach who is still working.
 */
export const settingsSchema = z.object({
  maxFileSizeMb: z.coerce.number().int().min(1).max(2000),
  maxFilesPerSubmission: z.coerce.number().int().min(1).max(20),
  retainResolvedHours: z.coerce.number().int().min(1).max(8760),
  retainUnpaidHours: z.coerce.number().int().min(1).max(8760),
});

/** Bytes, for comparing against a file size. */
export function maxFileSizeBytes(settings: PlatformSettings): number {
  return settings.maxFileSizeMb * 1024 * 1024;
}
