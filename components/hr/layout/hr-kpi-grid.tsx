import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface HrKpiGridProps {
  children: ReactNode;
  className?: string;
}

export function HrKpiGrid({ children, className }: HrKpiGridProps) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </section>
  );
}
