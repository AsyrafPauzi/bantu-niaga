"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export function OperationsMobileFab() {
  return (
    <Link
      href="/operations/orders"
      className="fixed bottom-20 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-600 lg:hidden"
      aria-label="New order"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </Link>
  );
}
