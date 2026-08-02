"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, ButtonLink, Field, inputClass } from "@/shared/ui";
// A client component imports the slice's own client-safe model directly, not
// the barrel — the barrel re-exports submissionApi (Postgres), which can't be
// bundled for the browser.
import { lookupSchema, type LookupInput } from "../model/submissionInput";
import type { PublicSubmission } from "../model/publicSubmission";
// Direct path, not the feedback barrel: the barrel re-exports Postgres code, and
// this is a client component. FeedbackAccess is client-only.
import { FeedbackAccess } from "@/domains/feedback/ui/FeedbackAccess";

type Result =
  | { state: "idle" }
  | { state: "error"; message: string }
  | { state: "loaded"; email: string; submissions: PublicSubmission[] };

/**
 * Email-as-identity status lookup.
 *
 * Validates with the same schema the API re-validates with, so a typo is caught
 * before it spends one of the caller's five-per-minute lookups.
 */
export function StatusLookup() {
  const [result, setResult] = useState<Result>({ state: "idle" });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LookupInput, unknown, { customerEmail: string }>({
    resolver: zodResolver(lookupSchema),
    mode: "onBlur",
  });

  const onSubmit = handleSubmit(async ({ customerEmail }) => {
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerEmail }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        submissions?: PublicSubmission[];
        error?: string;
      };

      if (!res.ok) {
        // 429 carries its own message about waiting; anything else is generic.
        setResult({
          state: "error",
          message: json.error ?? "Something went wrong.",
        });
        return;
      }

      setResult({
        state: "loaded",
        email: customerEmail,
        submissions: json.submissions ?? [],
      });
    } catch {
      setResult({ state: "error", message: "Network error. Please try again." });
    }
  });

  return (
    <div>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-6 sm:flex-row sm:items-start"
        noValidate
      >
        <div className="flex-1">
          <Field label="Email address" error={errors.customerEmail?.message}>
            <input
              {...register("customerEmail")}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="shrink-0 sm:mt-7"
        >
          {isSubmitting ? "Checking…" : "Check status"}
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
          <>
            <ul className="space-y-3">
              {result.submissions.map((submission, index) => (
                <StatusRow key={index} submission={submission} />
              ))}
            </ul>
            {result.submissions.some((s) => s.hasFeedback) && (
              <div className="mt-6">
                <FeedbackAccess email={result.email} />
              </div>
            )}
          </>
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
 * They collapse into honest, calm language about where the submission actually is.
 */
const STATUS_META: Record<
  PublicSubmission["status"],
  { label: string; className: string }
> = {
  // A draft never reaches the lookup — `findByCustomerEmail` filters it out —
  // but the map is exhaustive so a new status can't be added without deciding
  // what a customer should be told about it.
  draft: {
    label: "Not finished",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  awaiting_payment: {
    label: "Awaiting payment",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  new: {
    label: "Video received",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  assigned: {
    label: "With your coach",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  in_review: {
    label: "With your coach",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  // The coach has submitted; Yuta is doing a final check before it's released.
  // The customer doesn't need to know about that internal step — still "with
  // your coach" from their side, until it's actually ready.
  awaiting_approval: {
    label: "With your coach",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  complete: {
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
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.className}`}
      >
        {meta.label}
      </span>
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
