"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/shared/ui";
import { PlayerInfoForm } from "@/domains/submission/ui/PlayerInfoForm";
import type {
  SubmissionInput,
  SubmissionInputDraft,
} from "@/domains/submission/model/submissionInput";
import { VerifyPanel } from "@/domains/verification/ui/VerifyPanel";
import { UploadPanel } from "@/domains/upload/ui/UploadPanel";
import type {
  UploadMode,
  UploadedFile,
} from "@/domains/upload/ui/uploadTransport";
import { PaymentPanel } from "@/domains/payment/ui/PaymentPanel";
import type { CreatedIntent } from "@/domains/payment/api/paymentApi";
import {
  confirmPaymentAction,
  createIntentAction,
  listFlowFilesAction,
  resendCodeAction,
  startAnotherAction,
  startSubmissionAction,
  verifyCodeAction,
} from "../api/checkoutActions";
import type { CheckoutStep, FlowStep } from "../model/steps";
import { stepNumber } from "../model/steps";
import { StepIndicator } from "./StepIndicator";

/**
 * The four-step path from "I want feedback" to "you've been charged".
 *
 * **One route, four steps.** The steps don't get their own URLs, for the reason
 * ADR 005 gave when there were two of them: a full page navigation between
 * "your details" and "pay" reintroduces exactly the seam Elements was chosen to
 * remove, and the client secret would have to travel through a URL to survive
 * it.
 *
 * **The state is entirely client-side, and dies with the page.** There is no
 * resume — a refresh, a re-opened tab, or a shared machine always begins at step
 * 1. That is deliberate: only a completed payment earns retention, so a
 * half-finished submission is a scratch pad, and resuming one dropped customers
 * into somebody's abandoned attempt.
 *
 * The flow cookie still exists, but it is a *capability*, not a memory: the
 * server uses it to answer "which submission may this request touch" when
 * verifying a code or accepting an upload. Nothing reads it to decide which step
 * to show. The 3-D Secure return trip — the one case that used to need resuming
 * — lands on `/start?paid=1` instead, a standalone confirmation that reads no
 * state at all.
 *
 * This component owns the sequence and nothing else. Each step's panel belongs
 * to the domain that owns its subject.
 */
export function CheckoutFlow({
  uploadMode,
  maxFileSizeMb,
  maxFiles,
  paymentNotice,
}: {
  uploadMode: UploadMode;
  maxFileSizeMb: number;
  maxFiles: number;
  /** Set when the redirect return trip couldn't be confirmed. */
  paymentNotice?: string;
}) {
  const [step, setStep] = useState<FlowStep>("details");
  const [email, setEmail] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [intent, setIntent] = useState<CreatedIntent | null>(null);
  const [error, setError] = useState<string | null>(paymentNotice ?? null);
  /*
    Held in client state because nothing is resumed from the server: a page load
    always starts at step 1, so these only ever describe the attempt happening
    right now. `folder` arrives with step 1's result — it can't exist before the
    submission does.
  */
  const [details, setDetails] = useState<Partial<SubmissionInputDraft> | undefined>(
    undefined,
  );
  const [folder, setFolder] = useState("");

  if (step === "done") {
    return (
      <Confirmation
        playerName={playerName}
        fileCount={files.length}
        onStartAnother={startOver}
      />
    );
  }

  /*
    Abandon the current attempt and return to a clean step 1. The state lives
    only in React (a page load always starts fresh), so `router.refresh()` did
    NOT reset it — a soft refresh keeps client state, so "Start over" cleared the
    cookie but left the customer stranded on the same step. Resetting the state
    here is what actually takes them back.
  */
  async function startOver() {
    await startAnotherAction();
    setStep("details");
    setEmail("");
    setPlayerName("");
    setFiles([]);
    setIntent(null);
    setDetails(undefined);
    setFolder("");
    setError(null);
  }

  async function submitDetails(values: SubmissionInput) {
    setError(null);
    const result = await startSubmissionAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEmail(result.data.email);
    setFolder(result.data.uploadFolder);
    setPlayerName(values.playerName);
    // Remember what they typed, so stepping back shows it again.
    setDetails({
      customerEmail: values.customerEmail,
      playerName: values.playerName,
      playerAge: values.playerAge ? String(values.playerAge) : "",
      focus: values.focus ?? "",
      customerNotes: values.customerNotes ?? "",
    });
    setStep("verify");
  }

  async function submitCode(code: string): Promise<string | null> {
    const result = await verifyCodeAction(code);
    if (!result.ok) return result.error;

    // Files may already exist if they got this far before and came back.
    const existing = await listFlowFilesAction();
    if (existing.ok) setFiles(existing.data);

    setStep("upload");
    return null;
  }

  async function resend(): Promise<string | null> {
    const result = await resendCodeAction();
    return result.ok ? null : result.error;
  }

  async function toPayment() {
    setError(null);
    const current = await listFlowFilesAction();
    if (current.ok) setFiles(current.data);

    const result = await createIntentAction();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setIntent(result.data);
    setStep("pay");
  }

  async function onPaid(paymentIntentId: string) {
    const result = await confirmPaymentAction(paymentIntentId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep("done");
  }

  /*
    Which completed steps a customer may jump back to.

    `verify` is excluded once the email is proven: there is nothing to edit
    there and no code in hand, so sending someone back to it would be a dead
    end. Changing the email is done by going back to `details`, which clears the
    verification and re-sends a code — handled server-side in
    `updateDraftDetails`, so the two can't disagree.
  */
  function canGoTo(target: CheckoutStep): boolean {
    if (stepNumber(target) >= stepNumber(step as CheckoutStep)) return false;
    return target !== "verify";
  }

  function goTo(target: CheckoutStep) {
    if (!canGoTo(target)) return;
    setError(null);
    setStep(target);
  }

  return (
    <div className="space-y-8">
      <StepIndicator current={step} canGoTo={canGoTo} onGoTo={goTo} />

      {/* The verify panel shows its own errors inline, next to the input. */}
      {error && step !== "verify" && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {step === "details" && (
        <PlayerInfoForm
          defaultValues={details}
          submitLabel="Continue to email verification"
          pendingLabel="Sending your code…"
          onSubmit={submitDetails}
        />
      )}

      {step === "verify" && (
        <VerifyPanel
          email={email}
          onVerify={submitCode}
          onResend={resend}
          onBack={() => setStep("details")}
        />
      )}

      {step === "upload" && (
        <UploadPanel
          mode={uploadMode}
          folder={folder}
          maxFileSizeMb={maxFileSizeMb}
          maxFiles={maxFiles}
          initialFiles={files}
          onDone={toPayment}
        />
      )}

      {/*
        An explicit way out. A customer on a shared machine, or one who simply
        wants to start again, shouldn't have to clear cookies or wait out the
        timeout — and refreshing deliberately does NOT reset (see the comment on
        `initialStep`), so without this there'd be no way to abandon a
        half-finished submission on purpose.
      */}
      {step !== "details" && (
        <p className="text-center text-sm text-ink-muted">
          <button
            type="button"
            onClick={startOver}
            className="underline hover:text-ink"
          >
            Start over
          </button>
        </p>
      )}

      {step === "pay" && intent && (
        <PaymentPanel
          intent={intent}
          playerName={playerName}
          fileCount={files.length}
          onPaid={onPaid}
          onBack={() => setStep("upload")}
        />
      )}
    </div>
  );
}

/** The end of the flow — what was sent, and what happens next. */
function Confirmation({
  playerName,
  fileCount,
  onStartAnother,
}: {
  playerName: string;
  fileCount: number;
  onStartAnother: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="text-center">
      <div
        aria-hidden
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-2xl"
      >
        ✓
      </div>
      <h2 className="mt-6 text-3xl font-medium tracking-tight text-ink">
        You&rsquo;re all set
      </h2>
      <p className="mt-4 text-ink-soft">
        We&rsquo;ve got {fileCount} file{fileCount === 1 ? "" : "s"} for{" "}
        {playerName} and your payment went through. A receipt is on its way to
        your inbox.
      </p>
      <p className="mt-2 text-ink-soft">
        A coach will send a personal video walkthrough — we&rsquo;ll email you
        the moment it&rsquo;s ready.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onStartAnother();
            setBusy(false);
          }}
        >
          {busy ? "Starting…" : "Send another video"}
        </Button>
        <ButtonLink href="/status" variant="outline">
          Check your status
        </ButtonLink>
      </div>
    </div>
  );
}
