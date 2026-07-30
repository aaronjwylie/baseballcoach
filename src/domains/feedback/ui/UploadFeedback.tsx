"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui";

/** A coach uploads their feedback file for one submission, marking it complete. */
export function UploadFeedback({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setStatus("uploading");
    setError(null);
    try {
      const params = new URLSearchParams({ submission: submissionId, filename: file.name });
      const res = await fetch(`/api/feedback/upload?${params}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Upload failed.");
      }
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="file"
        disabled={status === "uploading"}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-surface"
      />
      <Button type="button" disabled={!file || status === "uploading"} onClick={upload}>
        {status === "uploading" ? "Sending…" : "Send feedback"}
      </Button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
