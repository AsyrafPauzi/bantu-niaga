"use client";

import { useCallback } from "react";
import { buildSampleCsv } from "@/lib/marketing/csv";
import { cn } from "@/lib/utils/cn";

/**
 * <CsvSampleDownload> — tiny inline link that materializes a sample
 * CSV via a Blob and triggers a browser download. No network round-
 * trip; the sample contents live in `lib/marketing/csv.ts` so the
 * parser + the sample agree by construction.
 */
export function CsvSampleDownload({ className }: { className?: string }) {
  const handle = useCallback(() => {
    const blob = new Blob([buildSampleCsv()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bantuniaga-sample-import.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <button
      type="button"
      onClick={handle}
      className={cn(
        "inline-flex items-center gap-1 text-sm text-brand-700 underline-offset-2 hover:underline",
        "dark:text-brand-300",
        className,
      )}
    >
      Download sample CSV
    </button>
  );
}
