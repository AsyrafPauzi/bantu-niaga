import { cn } from "@/lib/utils/cn";
import type { HTMLAttributes } from "react";

type BadgeTone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-cream-200 text-ink",
  brand: "bg-brand-50 text-brand-700",
  accent: "bg-accent-50 text-accent-700",
  success: "bg-brand-50 text-brand-700",
  warning: "bg-[#FDF2DC] text-[#8C5C0A]",
  danger: "bg-[#F8DDD9] text-[#8B2418]",
  info: "bg-[#DCE9F0] text-[#1F4E66]",
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
