import { Field } from "@/shared/ui";
import {
  LANGUAGE_CHOICES,
  type LanguageChoice,
} from "../model/coach";

/**
 * Which languages a coach reads — the half of the translation rule this form owns.
 *
 * Radios rather than the comma-separated text box this replaces. That box could
 * be left empty, and an empty column is the one input the rule can't answer: it
 * returns `null`, and the queue reports "no languages recorded for this coach"
 * instead of routing the submission. Three options with one always selected
 * makes that state unreachable from the form.
 *
 * Server components can render this — it's inputs and labels, no state. The
 * selection is plain form data, read back by `readLanguageChoice`.
 */
export function LanguageChoiceField({
  defaultChoice,
}: {
  defaultChoice: LanguageChoice;
}) {
  return (
    <Field
      label="Languages"
      hint="What this coach reads. A submission is translated when it shares none with the customer."
    >
      <div className="flex flex-wrap gap-3 pt-1">
        {LANGUAGE_CHOICES.map((choice) => (
          <label
            key={choice}
            className="flex items-center gap-1.5 text-sm text-ink-muted"
          >
            <input
              type="radio"
              name="languages"
              value={choice}
              defaultChecked={choice === defaultChoice}
            />
            {/* "both" is lowercase in the data because it isn't a language. */}
            {choice === "both" ? "Both" : choice}
          </label>
        ))}
      </div>
    </Field>
  );
}
