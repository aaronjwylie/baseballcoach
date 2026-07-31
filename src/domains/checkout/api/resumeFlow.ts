/**
 * What `/start` needs to render the flow.
 *
 * **There is no resume.** Every page load begins at step 1, always. Not "unless
 * paid", not "unless mid-upload" — always. The filename is a fossil of when it
 * did resume; the behaviour it described is gone.
 *
 * Why: only a completed payment earns retention (Yuta, 2026-07-30), and a
 * half-finished submission is a scratch pad. Resuming one meant a customer who
 * refreshed — or came back to a shared machine — landed inside someone's
 * abandoned attempt, which is exactly the "form seems cached" symptom this
 * replaced.
 *
 * The one case that genuinely used to need resuming is the **3-D Secure return
 * trip**, where the customer comes back on a cold page load with no client
 * state. That is now handled without resuming anything: `/api/payment/return`
 * confirms the payment server-side, clears the flow cookie, and redirects to
 * `/start?paid=1`, which renders a standalone confirmation. **No cookie is read
 * to decide a step**, so there is no path by which stale state survives a page
 * load.
 *
 * What's left is genuinely stateless: the operator's limits, and which upload
 * path this environment supports.
 */
import { storage } from "@/shared/storage";
import { getSettings } from "@/domains/settings";

export interface FlowResumeState {
  uploadMode: "blob" | "proxy";
  maxFileSizeMb: number;
  maxFiles: number;
}

export async function resolveFlowState(): Promise<FlowResumeState> {
  const settings = await getSettings();

  return {
    uploadMode: storage.supportsDirectUpload ? "blob" : "proxy",
    maxFileSizeMb: settings.maxFileSizeMb,
    maxFiles: settings.maxFilesPerSubmission,
  };
}
