import { cn } from "@/lib/utils/cn";

/**
 * Visual chip for a customer segment tag.
 *
 * Two flavours:
 *   - `kind="auto"` — system tag: vip / repeat / new / dormant / at-risk.
 *     Solid fill, color encoded per tag value (per the mission brief).
 *   - `kind="manual"` — user tag, cream outlined chip.
 *
 * Falls back to a neutral muted chip if an unknown auto-tag value is
 * passed; we still render the label so the operator sees it.
 */

export type TagKind = "auto" | "manual";

interface TagBadgeProps {
  label: string;
  kind?: TagKind;
  className?: string;
}

const AUTO_TONE: Record<string, string> = {
  vip: "bg-accent-700 text-white",
  repeat: "bg-brand-700 text-white",
  new: "bg-[#1F4E66] text-white",
  dormant: "bg-ink-muted text-white",
  "at-risk": "bg-[#8C5C0A] text-white",
};

const AUTO_FALLBACK = "bg-ink-muted text-white";

const MANUAL_TONE =
  "border border-cream-300 text-ink bg-transparent dark:border-hairline-dark dark:text-cream-200";

export function TagBadge({ label, kind = "auto", className }: TagBadgeProps) {
  const base =
    "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded uppercase tracking-wide";

  if (kind === "manual") {
    return (
      <span className={cn(base, MANUAL_TONE, "normal-case tracking-normal", className)}>
        {label}
      </span>
    );
  }

  const tone = AUTO_TONE[label] ?? AUTO_FALLBACK;
  return <span className={cn(base, tone, className)}>{label}</span>;
}
