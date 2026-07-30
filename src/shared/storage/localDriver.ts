/**
 * Local-disk storage driver (dev).
 *
 * Files live under `STORAGE_DIR`. The locator is the key itself; download
 * streams the file back. Keys are validated to stay under the root so a crafted
 * locator can't escape the storage dir.
 */
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "@/shared/config/env";
import type { OpenResult, StorageDriver } from "./types";

function root(): string {
  return path.resolve(env.storageDir);
}

/** Resolve a key to an absolute path, refusing anything outside the root. */
function resolveWithinRoot(key: string): string {
  const base = root();
  const full = path.resolve(base, key);
  if (full !== base && !full.startsWith(base + path.sep)) {
    throw new Error(`Refusing storage path outside root: ${key}`);
  }
  return full;
}

export const localDriver: StorageDriver = {
  async save(key, bytes) {
    const full = resolveWithinRoot(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return key;
  },

  async open(locator): Promise<OpenResult> {
    const full = resolveWithinRoot(locator);
    const stat = await fs.stat(full);
    const stream = Readable.toWeb(
      createReadStream(full),
    ) as ReadableStream<Uint8Array>;
    return {
      stream,
      contentType: contentTypeFor(locator),
      size: stat.size,
      filename: path.basename(locator),
    };
  },

  async remove(locator) {
    await fs.rm(resolveWithinRoot(locator), { force: true });
  },
};

function contentTypeFor(key: string): string {
  switch (path.extname(key).toLowerCase()) {
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
