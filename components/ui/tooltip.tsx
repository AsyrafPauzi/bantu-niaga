import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

export type TooltipSide = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  /** Text shown in the tooltip */
  content: string;
  children: ReactNode;
  /** Which side the tooltip floats toward (default: top) */
  side?: TooltipSide;
  className?: string;
}

/**
 * Pure-CSS hover tooltip — wraps any element (button, link, icon…)
 * and shows a styled label on hover/focus-visible.
 *
 * Uses a named group (`group/tooltip`) so nested parents that also use
 * `group` (e.g. table rows) do not incorrectly show the tip.
 *
 * Usage:
 *   <Tooltip content="Delete item">
 *     <button aria-label="Delete item"><Trash2 /></button>
 *   </Tooltip>
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <div className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          // base
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5",
          "bg-ink text-xs font-medium text-white shadow-elevated",
          "dark:bg-cream-50 dark:text-ink",
          // transition
          "opacity-0 transition-opacity delay-75 duration-150",
          "group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          // positioning
          side === "top" && "bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2",
          side === "bottom" && "top-[calc(100%+6px)] left-1/2 -translate-x-1/2",
          side === "left" && "right-[calc(100%+6px)] top-1/2 -translate-y-1/2",
          side === "right" && "left-[calc(100%+6px)] top-1/2 -translate-y-1/2",
        )}
      >
        {content}
        {/* Arrow */}
        <span
          aria-hidden
          className={cn(
            "absolute border-4 border-transparent",
            side === "top" &&
              "left-1/2 top-full -translate-x-1/2 border-t-ink dark:border-t-cream-50",
            side === "bottom" &&
              "bottom-full left-1/2 -translate-x-1/2 border-b-ink dark:border-b-cream-50",
            side === "left" &&
              "left-full top-1/2 -translate-y-1/2 border-l-ink dark:border-l-cream-50",
            side === "right" &&
              "right-full top-1/2 -translate-y-1/2 border-r-ink dark:border-r-cream-50",
          )}
        />
      </span>
    </div>
  );
}
