"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function HrToast({
  message,
  onDismiss,
  kind = "ok",
}: {
  message: string;
  onDismiss: () => void;
  kind?: "ok" | "err";
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-6 left-1/2 z-50 flex max-w-sm -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-3 shadow-lg",
        kind === "ok"
          ? "border-teal-200 bg-white dark:border-teal-900 dark:bg-panel-dark"
          : "border-red-200 bg-white dark:border-red-900 dark:bg-panel-dark",
      )}
    >
      {kind === "ok" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0D9488]" />
      ) : null}
      <p className="flex-1 text-sm font-medium text-ink dark:text-cream-100">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-lg p-1 text-ink-muted hover:bg-cream-100 dark:hover:bg-hairline-dark"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
