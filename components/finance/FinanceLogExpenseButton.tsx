"use client";

import { Plus } from "lucide-react";

export function FinanceLogExpenseButton() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("finance:log-expense"));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-rose-700 active:scale-[0.98]"
    >
      <Plus className="h-4 w-4" />
      Log expense
    </button>
  );
}
