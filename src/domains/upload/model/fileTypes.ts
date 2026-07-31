/**
 * What a customer is allowed to send us.
 *
 * **The single home for that question.** The file picker's `accept` attribute,
 * the browser-side pre-check, and the server's re-validation all read this
 * list, so they cannot drift into disagreeing — the same reason the submission
 * schemas are shared between form and route.
 *
 * Extension *and* MIME type are both listed because neither alone is reliable:
 * some browsers report an empty `type` for `.mov` and `.docx`, and a MIME type
 * is trivially spoofed. The server checks the extension, which is what actually
 * determines the stored object's name.
 *
 * Client-safe: no server imports, so a `"use client"` component may import this
 * module directly (structure.md §3b).
 */

export interface AllowedType {
  extension: string;
  mimeTypes: string[];
  /** How the UI groups it when explaining what's accepted. */
  group: "Video" | "Audio" | "Image" | "Document";
}

export const ALLOWED_TYPES: readonly AllowedType[] = [
  { extension: ".mp4", mimeTypes: ["video/mp4"], group: "Video" },
  { extension: ".mov", mimeTypes: ["video/quicktime"], group: "Video" },
  { extension: ".mp3", mimeTypes: ["audio/mpeg", "audio/mp3"], group: "Audio" },
  { extension: ".jpg", mimeTypes: ["image/jpeg"], group: "Image" },
  { extension: ".jpeg", mimeTypes: ["image/jpeg"], group: "Image" },
  { extension: ".png", mimeTypes: ["image/png"], group: "Image" },
  { extension: ".gif", mimeTypes: ["image/gif"], group: "Image" },
  { extension: ".pdf", mimeTypes: ["application/pdf"], group: "Document" },
  { extension: ".doc", mimeTypes: ["application/msword"], group: "Document" },
  {
    extension: ".docx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    group: "Document",
  },
] as const;

/**
 * The `accept` attribute for the file picker.
 *
 * Both extensions and MIME types: iOS Safari filters on MIME, desktop Chrome on
 * extension, and offering both is what makes the picker grey out the wrong
 * files on all of them.
 */
export const ACCEPT_ATTRIBUTE = [
  ...ALLOWED_TYPES.map((t) => t.extension),
  ...new Set(ALLOWED_TYPES.flatMap((t) => t.mimeTypes)),
].join(",");

/** Every MIME type we accept — what the Blob client token is scoped to. */
export const ALLOWED_MIME_TYPES = [
  ...new Set(ALLOWED_TYPES.flatMap((t) => t.mimeTypes)),
];

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot).toLowerCase();
}

/** Is this a file type we accept? Decided on the extension. */
export function isAllowedFilename(filename: string): boolean {
  const ext = extensionOf(filename);
  return ALLOWED_TYPES.some((t) => t.extension === ext);
}

/**
 * The content type to store, preferring the browser's when it is one we know
 * and falling back to the extension's when the browser gave us nothing useful.
 */
export function resolveContentType(
  filename: string,
  browserType: string | undefined,
): string {
  const ext = extensionOf(filename);
  const allowed = ALLOWED_TYPES.find((t) => t.extension === ext);
  if (!allowed) return "application/octet-stream";
  if (browserType && allowed.mimeTypes.includes(browserType)) return browserType;
  return allowed.mimeTypes[0];
}

/** "Video, audio, images, and documents" — the sentence under the file picker. */
export function describeAllowedTypes(): string {
  return ALLOWED_TYPES.map((t) => t.extension.replace(".", "").toUpperCase())
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(", ");
}
