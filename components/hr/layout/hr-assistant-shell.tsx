import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface HrAssistantShellProps {
  header: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Full-height HR assistant layout — no negative margins (avoids sidebar overlap).
 */
export function HrAssistantShell({
  header,
  children,
  className,
}: HrAssistantShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FFFEFB] dark:bg-surface-dark",
        className,
      )}
    >
      {header}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
