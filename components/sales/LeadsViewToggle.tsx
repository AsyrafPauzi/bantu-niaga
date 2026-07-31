"use client";

import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface LeadsViewToggleProps {
  view: "list" | "kanban";
  baseHref: string;
}

export function LeadsViewToggle({ view, baseHref }: LeadsViewToggleProps) {
  const listHref = baseHref.replace(/([?&])view=kanban(&|$)/, "$1").replace(/[?&]$/, "");
  const kanbanHref = baseHref.includes("?")
    ? `${baseHref}&view=kanban`
    : `${baseHref}?view=kanban`;

  return (
    <div className="inline-flex rounded-lg border border-cream-300 p-0.5 dark:border-hairline-dark">
      <Link
        href={listHref || "/sales/leads"}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold",
          view === "list"
            ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
            : "text-ink-muted hover:text-ink",
        )}
      >
        <List className="h-3.5 w-3.5" />
        List
      </Link>
      <Link
        href={kanbanHref}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold",
          view === "kanban"
            ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
            : "text-ink-muted hover:text-ink",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Board
      </Link>
    </div>
  );
}
