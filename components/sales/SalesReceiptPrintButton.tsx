"use client";

import { Printer } from "lucide-react";

export function SalesReceiptPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-cream-300 py-3 text-sm font-semibold text-ink-muted hover:border-brand-300 dark:border-hairline-dark"
    >
      <Printer className="h-4 w-4" />
      Print receipt
    </button>
  );
}
