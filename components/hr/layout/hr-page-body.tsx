import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface HrPageBodyProps {
  children: ReactNode;
  className?: string;
}

export function HrPageBody({ children, className }: HrPageBodyProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 px-6 py-6 pb-10 lg:px-8 lg:py-7 lg:pb-12",
        className,
      )}
    >
      {children}
    </div>
  );
}
