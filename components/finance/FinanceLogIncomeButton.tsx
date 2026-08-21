"use client";

import { Plus } from "lucide-react";

export function FinanceLogIncomeButton() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("finance:log-income"));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-emerald-700 active:scale-[0.98]"
    >
      <Plus className="h-4 w-4" />
      Log income
    </button>
  );
}
