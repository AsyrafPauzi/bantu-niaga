"use client";

import { Download } from "lucide-react";

export function InvoicePrintButton({ label }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 transition-colors print:hidden"
    >
      <Download className="h-4 w-4" />
      {label ?? "Download PDF"}
    </button>
  );
}
