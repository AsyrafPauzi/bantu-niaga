"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { salesClasses } from "@/lib/sales/theme";
import { MOBILE_FAB_ABOVE_NAV } from "@/lib/navigation/mobile-chrome";
import { cn } from "@/lib/utils/cn";

/** Sticky quick-sale on mobile Sales overview — sits above bottom tab bar. */
export function SalesMobileFab() {
  return (
    <Link
      href="/sales/pos"
      className={cn(
        "fixed right-4 z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-elevated transition-transform active:scale-95 lg:hidden",
        MOBILE_FAB_ABOVE_NAV,
        salesClasses.btnPrimary,
      )}
    >
      <Plus className="h-5 w-5" strokeWidth={2.5} />
      New sale
    </Link>
  );
}
