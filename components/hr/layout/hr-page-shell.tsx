import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface HrPageShellProps {
  header: ReactNode;
  children: ReactNode;
  className?: string;
}

/** HR page chrome inside the app shell main column. */
export function HrPageShell({ header, children, className }: HrPageShellProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col bg-[#FFFEFB] dark:bg-surface-dark",
        className,
      )}
    >
      {header}
      {children}
    </div>
  );
}
