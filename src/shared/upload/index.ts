/**
 * The browser's upload transport — domain-less on purpose.
 *
 * It moves bytes from a file input into storage and reports progress. It knows
 * nothing about submissions, feedback, or who is uploading.
 *
 * **It lived in `domains/upload/ui/` until 2026-08-06**, where three domains
 * reached across for it — `checkout`, `feedback`, and `upload` itself — which
 * is what put a `feedback → upload → feedback` cycle in the graph. It passes
 * the `shared/` test outright (`_StructureLaw` §5): *would putting this in a
 * domain force another domain to import it?* It already had, twice.
 */
export {
  uploadFile,
  type UploadMode,
  type UploadedFile,
  type UploadEndpoints,
  type UploadRequest,
} from "./uploadTransport";
