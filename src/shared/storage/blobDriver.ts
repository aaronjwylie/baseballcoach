/**
 * Vercel Blob storage driver (prod).
 *
 * `save` uploads and returns the public (unguessable) URL, which becomes the
 * locator; `open` just redirects to it. Access is public because the URL is a
 * random, unguessable token — the same URL-as-capability trade-off the app
 * already makes for the customer status lookup.
 */
import { put, del, get } from "@vercel/blob";
import { env } from "@/shared/config/env";
import type { OpenResult, StorageDriver } from "./types";

export const blobDriver: StorageDriver = {
  // Blob issues short-lived client tokens, so the browser uploads straight to
  // it — the only path past Vercel's ~4.5 MB serverless request body limit.
  supportsDirectUpload: true,

  async save(key, bytes, contentType) {
    const { url } = await put(key, Buffer.from(bytes), {
      // Private to match the store, and right for the content — customer video
      // of minors shouldn't be reachable by URL alone.
      access: "private",
      contentType,
      addRandomSuffix: false,
      token: env.blobToken,
    });
    return url;
  },

  // A private blob has no public URL to redirect to, so fetch it with the
  // store's token and hand the stream back. The download routes have already
  // checked the caller may have it, and stream what we return.
  async open(locator): Promise<OpenResult> {
    const result = await get(locator, {
      access: "private",
      token: env.blobToken,
    });
    if (!result) throw new Error(`Blob not found: ${locator}`);
    return {
      stream: result.stream ?? undefined,
      contentType: result.blob.contentType ?? undefined,
      size: result.blob.size ?? undefined,
    };
  },

  async remove(locator) {
    await del(locator, { token: env.blobToken });
  },
};
