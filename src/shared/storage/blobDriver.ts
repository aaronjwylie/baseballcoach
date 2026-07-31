/**
 * Vercel Blob storage driver (prod).
 *
 * `save` uploads and returns the public (unguessable) URL, which becomes the
 * locator; `open` just redirects to it. Access is public because the URL is a
 * random, unguessable token — the same URL-as-capability trade-off the app
 * already makes for the customer status lookup.
 */
import { put, del } from "@vercel/blob";
import { env } from "@/shared/config/env";
import type { OpenResult, StorageDriver } from "./types";

export const blobDriver: StorageDriver = {
  // Blob issues short-lived client tokens, so the browser uploads straight to
  // it — the only path past Vercel's ~4.5 MB serverless request body limit.
  supportsDirectUpload: true,

  async save(key, bytes, contentType) {
    const { url } = await put(key, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: false,
      token: env.blobToken,
    });
    return url;
  },

  async open(locator): Promise<OpenResult> {
    return { redirectTo: locator };
  },

  async remove(locator) {
    await del(locator, { token: env.blobToken });
  },
};
