"use client";

import Link from "next/link";
import type { BoardroomPendingAction } from "@/lib/ai/boardroom-actions";
import { cn } from "@/lib/utils/cn";

/** Navigation chips only — numbered actions in the card cover the rest. */
export function BoardroomActionChips({
  actions,
}: {
  actions: BoardroomPendingAction[];
}) {
  const links = actions.filter((a) => a.link_href?.trim());

  if (links.length === 0) return null;

  return (
    <div className="mt-4 border-t border-amber-400/20 pt-4">
      <p className="mb-2 text-xs text-amber-100/70">Open in app</p>
      <div className="flex flex-wrap gap-2">
        {links.map((action) => {
          const id = action.id ?? action.link_href!;
          return (
            <Link
              key={id}
              href={action.link_href!}
              className={cn(
                "inline-flex rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                "border-white/20 text-white/85 hover:bg-white/10",
              )}
            >
              {action.label ?? action.summary}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
