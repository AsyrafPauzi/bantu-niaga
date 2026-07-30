"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

export function FinanceMonthPicker({ value }: { value: string }) {
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm dark:border-hairline-dark dark:bg-panel-dark">
      <Calendar className="h-4 w-4 text-ink-muted dark:text-cream-400" />
      <input
        type="month"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) return;
          router.push(`/finance?month=${next}`);
        }}
        className="border-0 bg-transparent p-0 text-sm font-medium text-ink focus:outline-none focus:ring-0 dark:text-cream-100"
        aria-label="Select month"
      />
    </label>
  );
}
