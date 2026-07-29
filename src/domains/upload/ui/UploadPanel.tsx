"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ButtonLink } from "@/shared/ui";
import { site } from "@/shared/config/site";

// The uploader is a custom element; load it browser-side only.
const MuxUploader = dynamic(() => import("@mux/mux-uploader-react"), {
  ssr: false,
  loading: () => (
    <div className="h-48 animate-pulse rounded-2xl border border-dashed border-line bg-white" />
  ),
});

type Status = "idle" | "done" | "error";

export function UploadPanel({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Called by the uploader right before it starts; returns the Mux upload URL.
  const getUploadUrl = useCallback(async () => {
    setErrorMessage(null);
    const res = await fetch("/api/mux/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!res.ok || !json.url) {
      const message = json.error ?? "Could not prepare the upload.";
      setStatus("error");
      setErrorMessage(message);
      throw new Error(message);
    }
    return json.url;
  }, [sessionId]);

  if (status === "done") {
    return <Confirmation />;
  }

  return (
    <div>
      <div className="rounded-2xl border border-line bg-white p-4 sm:p-6">
        <MuxUploader
          endpoint={getUploadUrl}
          onSuccess={() => setStatus("done")}
          onUploadError={() => {
            setStatus("error");
            setErrorMessage(
              "The upload didn't finish. Please check your connection and try again.",
            );
          }}
          style={{ "--progress-bar-fill-color": "#e11d48" }}
        />
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
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
