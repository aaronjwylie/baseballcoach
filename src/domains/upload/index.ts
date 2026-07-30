/**
 * The upload domain — getting the video to us.
 *
 * The file goes browser → our upload route → storage; the domain owns saving it
 * and moving the submission to `new`, plus the "video received" email.
 */
export { storeVideo } from "./api/uploadApi";
export { sendVideoReceived } from "./api/uploadEmail";
export { UploadPanel } from "./ui/UploadPanel";
