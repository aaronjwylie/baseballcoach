/**
 * The feedback domain — the coach's response coming back.
 *
 * Almost entirely off-platform in v1: the coach records a Loom, Yuta pastes the
 * link into Airtable, and our only job is telling the customer it's ready. The
 * feedback viewer page (CLAUDE.md Sprint 5) is the part still to build.
 */
export { sendFeedbackReady } from "./api/feedbackEmail";
