/**
 * The settings domain — the operator's knobs on upload limits and retention.
 *
 * Server-only: the barrel re-exports database code, so a client component
 * imports `model/settings` directly rather than from here (structure.md §3b).
 */
export { getSettings, updateSettings } from "./api/settingsApi";
export {
  updateSettingsAction,
  type SettingsFormState,
} from "./api/settingsActions";
export { SettingsForm } from "./ui/SettingsForm";
export {
  DEFAULT_SETTINGS,
  maxFileSizeBytes,
  settingsSchema,
  type PlatformSettings,
} from "./model/settings";
