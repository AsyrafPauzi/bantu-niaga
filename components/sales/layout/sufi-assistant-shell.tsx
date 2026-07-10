import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface SufiAssistantShellProps {
  header: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Full-height Sufi assistant layout — no negative margins (avoids sidebar overlap).
 */
export function SufiAssistantShell({
  header,
  children,
  className,
}: SufiAssistantShellProps) {
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
