"use client";

import {
  CHECKOUT_STEPS,
  TOTAL_STEPS,
  stepNumber,
  type CheckoutStep,
} from "../model/steps";

/**
 * "Step 2 of 4", with the road behind and ahead.
 *
 * Worth the space: the flow now asks for a code and a set of files before it
 * asks for money, and a customer who can't see how much is left reads the extra
 * steps as the process going wrong rather than as three short steps.
 *
 * **Completed steps are buttons, not decoration.** A customer who spots a typo
 * in their email at step 3, or wants one more clip while looking at the payment
 * form, can go straight back. Only backwards — a step you haven't reached isn't
 * a link, because skipping the gate is exactly what the flow exists to prevent.
 * The parent decides what's reachable via `canGoTo`; this only draws it.
 *
 * The full labels are hidden below `sm` — on a phone the counter and the current
 * step's name carry the same information without wrapping to three lines.
 */
export function StepIndicator({
  current,
  canGoTo,
  onGoTo,
}: {
  current: CheckoutStep;
  canGoTo?: (step: CheckoutStep) => boolean;
  onGoTo?: (step: CheckoutStep) => void;
}) {
  const currentNumber = stepNumber(current);

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Step {currentNumber} of {TOTAL_STEPS}
      </p>

      <ol className="mt-3 flex gap-2" aria-label="Progress">
        {CHECKOUT_STEPS.map((step, index) => {
          const position = index + 1;
          const done = position < currentNumber;
          const active = position === currentNumber;
          const reachable = done && !!onGoTo && (canGoTo?.(step.key) ?? true);

          const bar = (
            <div
              className={`h-1.5 rounded-full transition-colors ${
                done || active ? "bg-ink" : "bg-paper-alt"
              } ${reachable ? "group-hover:bg-ink-soft" : ""}`}
            />
          );
          const label = (
            <span
              className={`mt-2 hidden text-xs sm:block ${
                active ? "font-semibold text-ink" : "text-ink-muted"
              } ${reachable ? "group-hover:text-ink group-hover:underline" : ""}`}
            >
              {step.label}
            </span>
          );

          return (
            <li
              key={step.key}
              className="flex-1"
              aria-current={active ? "step" : undefined}
            >
              {reachable ? (
                <button
                  type="button"
                  onClick={() => onGoTo?.(step.key)}
                  className="group block w-full cursor-pointer text-left"
                >
                  <span className="sr-only">Go back to </span>
                  {bar}
                  {label}
                </button>
              ) : (
                <>
                  {bar}
                  {label}
                </>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-sm font-semibold text-ink sm:hidden">
        {CHECKOUT_STEPS[currentNumber - 1]?.label}
      </p>
    </div>
  );
}
