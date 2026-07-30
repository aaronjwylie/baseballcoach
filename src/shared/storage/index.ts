/**
 * The `shared/storage` barrel — pick the driver by environment.
 *
 * Blob when a token is configured (prod), local disk otherwise (dev). Callers
 * import `storage` and never touch a driver directly.
 */
import { env } from "@/shared/config/env";
import type { StorageDriver } from "./types";
import { localDriver } from "./localDriver";
import { blobDriver } from "./blobDriver";

export const storage: StorageDriver = env.blobToken ? blobDriver : localDriver;

/** Build the storage key for a submission's customer video. */
export function videoKey(submissionId: string, filename: string): string {
  return `submissions/${submissionId}/video${extname(filename)}`;
}

/** Build the storage key for a coach's feedback file. */
export function feedbackKey(submissionId: string, filename: string): string {
  return `submissions/${submissionId}/feedback${extname(filename)}`;
}

function extname(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = filename.slice(dot).toLowerCase();
  // Only allow a short known-safe set; anything else is dropped.
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : "";
}

export type { StorageDriver, OpenResult } from "./types";
