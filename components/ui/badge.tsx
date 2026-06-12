import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

type BadgeTone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-cream-200 text-ink dark:bg-panel-dark dark:text-cream-200",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  accent:
    "bg-accent-50 text-accent-700 dark:bg-accent-700/30 dark:text-accent-200",
  success: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  warning: "bg-[#FDF2DC] text-[#8C5C0A] dark:bg-[#3A2A0A] dark:text-[#F5C97A]",
  danger: "bg-[#F8DDD9] text-[#8B2418] dark:bg-[#3A1714] dark:text-[#F0B0A6]",
  info: "bg-[#DCE9F0] text-[#1F4E66] dark:bg-[#13303D] dark:text-[#A6CFE0]",
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
