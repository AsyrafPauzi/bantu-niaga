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
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
        className,
      )}
    >
      {children}
    </section>
  );
}
