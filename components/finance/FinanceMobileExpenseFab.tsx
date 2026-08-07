"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

/** Sticky quick-add on mobile Finance home — sits above bottom tab bar. */
export function FinanceMobileExpenseFab({
  expensesAllowed = true,
}: {
  expensesAllowed?: boolean;
}) {
  if (!expensesAllowed) return null;

  return (
    <Link
      href="/finance/expenses?create=1"
      className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-elevated transition-transform hover:bg-brand-600 active:scale-95 lg:hidden"
    >
      <Plus className="h-5 w-5" strokeWidth={2.5} />
      Expense
    </Link>
  );
}
