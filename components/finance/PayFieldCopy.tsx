"use client";

import { useCallback, useState } from "react";

export function PayFieldCopy({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-cream-300 bg-cream-100 px-3 py-2.5 dark:border-hairline-dark dark:bg-hairline-dark/40">
      <div className="min-w-0">
        <p className="text-xs text-ink-muted dark:text-cream-400">{label}</p>
        <p className="truncate font-medium text-ink dark:text-cream-100">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onCopy()}
        className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-900/30"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
