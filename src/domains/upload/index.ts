/**
 * The upload domain — getting the video to us.
 *
 * All verb, and deliberately thin: the file goes browser → Mux directly, so the
 * only thing we own is minting permission and reacting when Mux says it's ready.
 */
export { createDirectUpload } from "./api/uploadApi";
export { sendVideoReceived } from "./api/uploadEmail";
export { UploadPanel } from "./ui/UploadPanel";
