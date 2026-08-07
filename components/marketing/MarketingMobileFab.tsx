"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { MOBILE_FAB_ABOVE_NAV } from "@/lib/navigation/mobile-chrome";
import { cn } from "@/lib/utils/cn";

export function MarketingMobileFab() {
  return (
    <Link
      href="/marketing/customers/new"
      className={cn(
        "fixed right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-600 lg:hidden",
        MOBILE_FAB_ABOVE_NAV,
      )}
      aria-label="New customer"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </Link>
  );
}
