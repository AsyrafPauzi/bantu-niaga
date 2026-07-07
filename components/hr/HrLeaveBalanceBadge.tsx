import type { HrEmployeeLeaveBalance } from "@/lib/hr/load";

export function HrLeaveBalanceBadge({
  balance,
}: {
  balance: HrEmployeeLeaveBalance;
}) {
  const used = balance.takenDays;
  const total = balance.entitlementDays;
  const tone =
    balance.availableDays <= 0
      ? "text-status-warning"
      : balance.availableDays <= 2
        ? "text-accent-700 dark:text-accent-300"
        : "text-status-success";

  return (
    <div className="rounded-xl border border-[#E5E0D8] bg-cream-50 px-4 py-3 dark:border-hairline-dark dark:bg-panel-dark/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
        Annual leave ({balance.leaveYear})
      </p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>
        {balance.availableDays} of {total} days left
      </p>
      <p className="text-xs text-ink-muted dark:text-cream-400">
        {used} working day(s) approved · excludes weekends & public holidays
      </p>
    </div>
  );
}
