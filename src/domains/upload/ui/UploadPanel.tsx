"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/shared/ui";
import { site } from "@/shared/config/site";

type Status = "idle" | "uploading" | "done" | "error";

export function UploadPanel({ paymentIntentId }: { paymentIntentId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setStatus("uploading");
    setError(null);
    try {
      const params = new URLSearchParams({
        payment_intent: paymentIntentId,
        filename: file.name,
      });
      const res = await fetch(`/api/upload?${params}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "The upload didn't finish. Please try again.");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "The upload didn't finish.");
    }
  }

  if (status === "done") return <Confirmation />;

  return (
    <div>
      <div className="rounded-2xl border border-dashed border-line bg-white p-6">
        <label className="block text-sm font-medium text-ink">
          Choose your video
          <input
            type="file"
            accept="video/*"
            disabled={status === "uploading"}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-ink-muted file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-surface hover:file:bg-ink-soft"
          />
        </label>

        <Button
          type="button"
          size="lg"
          className="mt-5 w-full"
          disabled={!file || status === "uploading"}
          onClick={upload}
        >
          {status === "uploading" ? "Uploading…" : "Upload video"}
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <ul className="mt-6 space-y-2 text-sm text-ink-muted">
        <li>• MP4 or MOV, ideally under five minutes.</li>
        <li>• Side-on and front-on angles help the coach most.</li>
        <li>• Keep this tab open until the upload finishes.</li>
      </ul>
    </div>
  );
}

function Confirmation() {
  return (
    <div className="rounded-2xl border border-line bg-white p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="mt-5 text-2xl font-bold text-ink">Your video is in ✅</h2>
      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        We&apos;ve got it and it&apos;s queued for review. A coach will send a
        personal breakdown to your email within{" "}
        <strong className="text-ink">{site.turnaroundDays}</strong>. You can
        close this tab.
      </p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink href="/status" variant="outline">
          Track your submission
        </ButtonLink>
        <ButtonLink href="/" variant="outline">
          Back to home
        </ButtonLink>
      </div>
      <p className="mt-6 text-xs text-ink-muted">
        Questions? Email{" "}
        <Link href={`mailto:${site.email}`} className="underline">
          {site.email}
        </Link>
        .
      </p>
    </div>
  );
}
