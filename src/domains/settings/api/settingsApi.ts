/**
 * Reading and writing the one settings row.
 *
 * The only place the app touches the `settings` table. `SETTINGS_ID` is fixed,
 * so "the settings" is always one row and the table cannot grow a second.
 */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, settings } from "@/shared/db";
import type { SettingsRow } from "@/shared/db";
import {
  DEFAULT_SETTINGS,
  type PlatformSettings,
} from "../model/settings";

const SETTINGS_ID = "default";

function fromRow(row: SettingsRow): PlatformSettings {
  return {
    maxFileSizeMb: row.maxFileSizeMb,
    maxFilesPerSubmission: row.maxFilesPerSubmission,
    retainResolvedHours: row.retainResolvedHours,
    retainUnpaidHours: row.retainUnpaidHours,
  };
}

/**
 * The current settings, creating the row on first read.
 *
 * Wrapped in React's `cache` so the several places that need a limit during one
 * request — the upload route validating a file, the flow rendering its hint
 * text — share a single query rather than each making their own.
 */
export const getSettings = cache(async function getSettings(): Promise<PlatformSettings> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID))
    .limit(1);

  if (row) return fromRow(row);

  // First read on a fresh database. Insert the defaults rather than returning
  // them, so the admin form has something to edit. `onConflictDoNothing` covers
  // two requests racing to be first.
  const [created] = await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...DEFAULT_SETTINGS })
    .onConflictDoNothing()
    .returning();

  return created ? fromRow(created) : DEFAULT_SETTINGS;
});

export async function updateSettings(
  next: PlatformSettings,
): Promise<PlatformSettings> {
  const [row] = await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.id,
      set: { ...next, updatedAt: new Date() },
    })
    .returning();

  return fromRow(row);
}
