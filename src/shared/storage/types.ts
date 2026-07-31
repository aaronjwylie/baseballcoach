/**
 * The storage seam — one interface, swappable drivers.
 *
 * Uploaded files and feedback files go through here. In dev the local-disk
 * driver writes under `STORAGE_DIR`; in prod the Blob driver uploads to Vercel
 * Blob. A caller stores whatever `save` returns (the *locator*) on the row and
 * later hands it back to `open` — it never needs to know which driver is behind
 * it. (ADR 006.)
 */

/** How to serve a stored object back for download. */
export interface OpenResult {
  // Local disk: we stream the bytes ourselves.
  stream?: ReadableStream<Uint8Array>;
  contentType?: string;
  size?: number;
  filename?: string;
  // Blob: the object has its own hosted URL; redirect to it instead.
  redirectTo?: string;
}

export interface StorageDriver {
  /**
   * Whether the browser can upload straight to this driver.
   *
   * True for Blob, which issues a short-lived client token and takes the bytes
   * directly — the only way past Vercel's ~4.5 MB limit on a serverless request
   * body, and therefore the only way a phone video ever arrives in production.
   *
   * False for local disk, which has no public endpoint; in dev the bytes go
   * through our own route instead, which is fine at the sizes dev deals with.
   */
  readonly supportsDirectUpload: boolean;

  /**
   * Save bytes under a logical key (e.g. `submissions/<id>/ab12-clip.mp4`).
   * Returns the **locator** to persist on the row — the key for local disk, the
   * public URL for Blob.
   */
  save(key: string, bytes: Uint8Array, contentType: string): Promise<string>;

  /** Open a previously-saved locator for download. */
  open(locator: string): Promise<OpenResult>;

  /** Best-effort delete. */
  remove(locator: string): Promise<void>;
}
