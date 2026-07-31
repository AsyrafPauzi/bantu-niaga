"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

/** Sticky quick-sale on mobile Sales overview — sits above bottom tab bar. */
export function SalesMobileFab() {
  return (
    <Link
      href="/sales/pos"
      className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-elevated transition-transform hover:bg-orange-700 active:scale-95 lg:hidden"
    >
      <Plus className="h-5 w-5" strokeWidth={2.5} />
      New sale
    </Link>
  );
}
