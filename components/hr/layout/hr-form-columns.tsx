import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface HrFormColumnsProps {
  form: ReactNode;
  help?: ReactNode;
  className?: string;
}

export function HrFormColumns({ form, help, className }: HrFormColumnsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8",
        className,
      )}
    >
      <div className="min-w-0 lg:max-w-[560px]">{form}</div>
      {help ? <aside className="min-w-0 space-y-4">{help}</aside> : null}
    </div>
  );
}
