"use client";

import { Plus } from "lucide-react";

export function OperationsAddResourceButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("operations:add-resource"))}
      className="inline-flex items-center gap-1.5 rounded-xl border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-transform hover:bg-cream-50 active:scale-[0.98] dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100 dark:hover:bg-hairline-dark/40"
    >
      <Plus className="h-4 w-4" />
      Add resource
    </button>
  );
}
