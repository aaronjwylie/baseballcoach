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
