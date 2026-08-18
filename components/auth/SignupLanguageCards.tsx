"use client";

import { cn } from "@/lib/utils/cn";

type Locale = "en" | "ms";

const OPTIONS: readonly { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ms", label: "Bahasa Melayu" },
];

export function SignupLanguageCards({
  value,
  onChange,
}: {
  value: Locale | null;
  onChange: (next: Locale) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-ink dark:text-cream-100">
        Language
      </legend>
      <div
        role="radiogroup"
        aria-label="Language"
        className="grid gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors",
                "focus-within:ring-2 focus-within:ring-brand-400",
                selected
                  ? "border-accent-500 bg-brand-50 dark:bg-brand-900/30"
                  : "border-cream-300 bg-white hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-700",
              )}
            >
              <input
                type="radio"
                name="preferred-locale"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "text-sm font-semibold",
                  selected
                    ? "text-brand-700 dark:text-brand-200"
                    : "text-ink dark:text-cream-100",
                )}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
        Used for emails. You can change this later in Settings.
      </p>
    </fieldset>
  );
}
