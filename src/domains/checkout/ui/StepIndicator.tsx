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
 * The full labels are hidden below `sm` — on a phone the counter and the current
 * step's name carry the same information without wrapping to three lines.
 */
export function StepIndicator({ current }: { current: CheckoutStep }) {
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

          return (
            <li
              key={step.key}
              className="flex-1"
              aria-current={active ? "step" : undefined}
            >
              <div
                className={`h-1.5 rounded-full ${
                  done || active ? "bg-ink" : "bg-paper-alt"
                }`}
              />
              <span
                className={`mt-2 hidden text-xs sm:block ${
                  active ? "font-semibold text-ink" : "text-ink-muted"
                }`}
              >
                {step.label}
              </span>
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
