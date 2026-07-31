"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import type { FlowStep } from "../model/steps";
import { StepIndicator } from "./StepIndicator";

/**
 * The four-step path from "I want feedback" to "you've been charged".
 *
 * **One route, four steps.** The steps don't get their own URLs, for the reason
 * ADR 005 gave when there were two of them: a full page navigation between
 * "your details" and "pay" reintroduces exactly the seam Elements was chosen to
 * remove, and the client secret would have to travel through a URL to survive
 * it. What makes that safe across four steps is that the *server* remembers
 * which submission this browser owns, in the flow cookie — so a refresh, a
 * closed tab, or a redirect home from 3-D Secure all resume where they left off
 * rather than starting over. `initialStep` is that answer.
 *
 * This component owns the sequence and nothing else. Each step's panel belongs
 * to the domain that owns its subject.
 */
export function CheckoutFlow({
  initialStep,
  initialEmail,
  initialPlayerName,
  initialDetails,
  initialFiles,
  uploadMode,
  uploadFolder,
  maxFileSizeMb,
  maxFiles,
  paymentNotice,
}: {
  initialStep: FlowStep;
  initialEmail: string;
  initialPlayerName: string;
  initialDetails?: Partial<SubmissionInputDraft>;
  initialFiles: UploadedFile[];
  uploadMode: UploadMode;
  uploadFolder: string;
  maxFileSizeMb: number;
  maxFiles: number;
  /** Set when the redirect return trip couldn't be confirmed. */
  paymentNotice?: string;
}) {
  const router = useRouter();

  const [step, setStep] = useState<FlowStep>(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);
  const [intent, setIntent] = useState<CreatedIntent | null>(null);
  const [error, setError] = useState<string | null>(paymentNotice ?? null);

  if (step === "done") {
    return (
      <Confirmation
        playerName={playerName}
        fileCount={files.length}
        onStartAnother={async () => {
          await startAnotherAction();
          router.refresh();
        }}
      />
    );
  }

  async function submitDetails(values: SubmissionInput) {
    setError(null);
    const result = await startSubmissionAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEmail(result.data.email);
    setPlayerName(values.playerName);
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

  return (
    <div className="space-y-8">
      <StepIndicator current={step} />

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
          defaultValues={initialDetails}
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
          folder={uploadFolder}
          maxFileSizeMb={maxFileSizeMb}
          maxFiles={maxFiles}
          initialFiles={files}
          onDone={toPayment}
        />
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
