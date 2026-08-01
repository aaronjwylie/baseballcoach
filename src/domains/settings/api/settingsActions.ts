"use server";
/**
 * The admin's verb on settings. Admin-only, re-checked here rather than trusted
 * from the UI — the same rule every mutating action in the portal follows.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@/domains/account";
import { settingsSchema } from "../model/settings";
import { updateSettings } from "./settingsApi";

export type SettingsFormState = { error: string } | { ok: true } | undefined;

export async function updateSettingsAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireRole("admin");

  // The form collects the price in dollars; the schema and DB store cents.
  const priceDollars = Number(formData.get("priceDollars"));
  const parsed = settingsSchema.safeParse({
    priceCents: Number.isFinite(priceDollars) ? Math.round(priceDollars * 100) : NaN,
    maxFileSizeMb: formData.get("maxFileSizeMb"),
    maxFilesPerSubmission: formData.get("maxFilesPerSubmission"),
    retainResolvedHours: formData.get("retainResolvedHours"),
    retainUnpaidHours: formData.get("retainUnpaidHours"),
  });

  if (!parsed.success) {
    return {
      error:
        "Check the values: price $1–$10,000, size 1–2000 MB, 1–20 files, and retention between 1 hour and a year.",
    };
  }

  try {
    await updateSettings(parsed.data);
  } catch (err) {
    console.error("[settings] update failed:", err);
    return { error: "Could not save the settings. Please try again." };
  }

  revalidatePath("/admin/settings");
  // The price shows on these (statically rendered) pages, so a change to it has
  // to invalidate them too — otherwise the card and the charge could disagree.
  revalidatePath("/");
  revalidatePath("/start");
  revalidatePath("/terms");
  return { ok: true };
}
