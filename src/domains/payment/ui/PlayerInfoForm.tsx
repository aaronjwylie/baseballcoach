"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { Button, Field, inputClass } from "@/shared/ui";
// Client-safe imports from the submission slice's model, not its barrel — the
// barrel pulls in Postgres-backed queries that can't ship to the browser.
import { FOCUS_OPTIONS } from "@/domains/submission/model/submission";
import {
  submissionInputSchema,
  type SubmissionInput,
  type SubmissionInputDraft,
} from "@/domains/submission/model/submissionInput";
import type { CreatedIntent } from "../api/paymentApi";

/**
 * Step one — everything we collect before taking money.
 *
 * Validates with the **same schema the API re-validates with**, so the two can't
 * drift into disagreeing about what's acceptable. The server still re-checks:
 * this is a courtesy to honest users, not a security boundary.
 *
 * On success it hands a PaymentIntent up to the parent rather than navigating.
 * Keeping both steps on one route is what makes payment feel like part of the
 * product instead of an errand (ADR 005) — and it keeps the client secret in
 * memory rather than in a URL.
 */
export function PlayerInfoForm({
  onIntentCreated,
}: {
  onIntentCreated: (intent: CreatedIntent, playerName: string) => void;
}) {
  const searchParams = useSearchParams();
  const wasCanceled = searchParams.get("canceled") === "1";

  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    // Three generics because the schema transforms: the form holds raw strings
    // (the Draft), while handleSubmit receives the parsed output.
  } = useForm<SubmissionInputDraft, unknown, SubmissionInput>({
    resolver: zodResolver(submissionInputSchema),
    // Validate on blur rather than on every keystroke — flagging an email as
    // invalid while it's still being typed is hostile.
    mode: "onBlur",
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      const res = await fetch("/api/payment/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<CreatedIntent> & {
        error?: string;
      };

      if (!res.ok || !json.clientSecret || !json.paymentIntentId) {
        setSubmitError(json.error ?? "Something went wrong. Please try again.");
        return;
      }

      onIntentCreated(
        {
          clientSecret: json.clientSecret,
          paymentIntentId: json.paymentIntentId,
          amountCents: json.amountCents ?? 0,
          currency: json.currency ?? "cad",
        },
        values.playerName,
      );
    } catch {
      setSubmitError(
        "Network error. Please check your connection and try again.",
      );
    }
  });

  const busy = isSubmitting;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {wasCanceled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout was canceled — no charge was made. You can try again below.
        </p>
      )}

      <Field
        label="Your email"
        hint="We'll send confirmations and feedback here."
        error={errors.customerEmail?.message}
      >
        <input
          {...register("customerEmail")}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
        />
      </Field>

      <Field
        label="Player's name"
        hint="If the player is a minor, a parent or guardian should submit."
        error={errors.playerName?.message}
      >
        <input
          {...register("playerName")}
          type="text"
          placeholder="e.g. Alex Tanaka"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Player's age" optional error={errors.playerAge?.message}>
          <input
            {...register("playerAge")}
            type="text"
            inputMode="numeric"
            maxLength={2}
            placeholder="e.g. 14"
            className={inputClass}
          />
        </Field>

        <Field label="Focus" optional error={errors.focus?.message}>
          <select {...register("focus")} defaultValue="" className={inputClass}>
            <option value="">Not sure / general</option>
            {FOCUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Anything you want the coach to look at?"
        optional
        hint="Optional — a specific issue, a recent change, a goal."
        error={errors.customerNotes?.message}
      >
        <textarea
          {...register("customerNotes")}
          rows={3}
          placeholder="e.g. Trying to fix an early bat drop on inside pitches."
          className={`${inputClass} resize-none`}
        />
      </Field>

      {submitError && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {submitError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? "Preparing checkout…" : "Continue to payment"}
      </Button>
    </form>
  );
}
