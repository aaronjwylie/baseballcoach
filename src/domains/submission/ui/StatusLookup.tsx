"use client";

import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/shared/ui";
import type { PublicSubmission } from "@/domains/submission";

type Result =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "loaded"; email: string; submissions: PublicSubmission[] };

export function StatusLookup() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Result>({ state: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setResult({ state: "loading" });

    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerEmail: trimmed }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        submissions?: PublicSubmission[];
        error?: string;
      };
      if (!res.ok) {
        setResult({
          state: "error",
          message: json.error ?? "Something went wrong.",
        });
        return;
      }
      setResult({
        state: "loaded",
        email: trimmed,
        submissions: json.submissions ?? [],
      });
    } catch {
      setResult({
        state: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6 sm:flex-row sm:items-end"
      >
        <label className="flex-1">
          <span className="mb-1.5 block text-sm font-medium text-ink">
            Email address
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <Button
          type="submit"
          size="lg"
          disabled={result.state === "loading"}
          className="shrink-0"
        >
          {result.state === "loading" ? "Checking…" : "Check status"}
        </Button>
      </form>

      <div className="mt-6">
        {result.state === "error" && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {result.message}
          </p>
        )}

        {result.state === "loaded" && result.submissions.length === 0 && (
          <div className="rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-ink">
              No submissions found for{" "}
              <span className="font-medium">{result.email}</span>.
            </p>
            <p className="mt-1.5 text-sm text-ink-muted">
              Double-check the address, or start a new review.
            </p>
            <div className="mt-5">
              <ButtonLink href="/start">Start a review</ButtonLink>
            </div>
          </div>
        )}

        {result.state === "loaded" && result.submissions.length > 0 && (
          <ul className="space-y-3">
            {result.submissions.map((submission, index) => (
              <StatusRow key={index} submission={submission} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Customer-facing labels for each status.
 *
 * "New" and "Assigned" are queue states that exist for Yuta, not the customer —
 * telling a parent their video is "unassigned" is alarming and not actionable.
 * They collapse into honest, calm language about where the video actually is.
 */
const STATUS_META: Record<
  PublicSubmission["status"],
  { label: string; className: string }
> = {
  "Awaiting Upload": {
    label: "Awaiting your video",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  New: {
    label: "Video received",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  Assigned: {
    label: "With your coach",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  "In Review": {
    label: "With your coach",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  Complete: {
    label: "Feedback ready",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

function StatusRow({ submission }: { submission: PublicSubmission }) {
  const meta = STATUS_META[submission.status];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-5">
      <div>
        <div className="font-semibold text-ink">{submission.playerName}</div>
        <div className="mt-0.5 text-sm text-ink-muted">
          {submission.focus ? `${submission.focus} · ` : ""}
          {formatDate(submission.submittedAt)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.className}`}
        >
          {meta.label}
        </span>
        {submission.status === "Complete" && submission.feedbackVideoUrl && (
          <ButtonLink
            href={submission.feedbackVideoUrl}
            size="md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch feedback
          </ButtonLink>
        )}
      </div>
    </li>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
