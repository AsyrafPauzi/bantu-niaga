import { cn } from "@/lib/utils/cn";
import type { CouponStatus } from "@/lib/marketing/coupons";

/**
 * Status pill for the coupons list + detail header.
 *
 * Tone mapping:
 *   active  → green  (Tailwind status-success)
 *   paused  → amber  (status-warning)
 *   expired → neutral (cream-200 / hairline-dark)
 */
export interface CouponStatusBadgeProps {
  status: CouponStatus;
  className?: string;
}

const TONE: Record<CouponStatus, string> = {
  active:
    "bg-status-success/15 text-status-success dark:bg-status-success/20",
  paused:
    "bg-status-warning/20 text-[#8C5C0A] dark:bg-status-warning/15 dark:text-[#F5C97A]",
  expired:
    "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
};

const LABEL: Record<CouponStatus, string> = {
  active: "Active",
  paused: "Paused",
  expired: "Expired",
};

export function CouponStatusBadge({ status, className }: CouponStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        TONE[status],
        className,
      )}
    >
      {LABEL[status]}
    </span>
  );
}
