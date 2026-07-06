import { HrWarningBanner } from "@/components/hr/layout/hr-warning-banner";

export function HolidaysNoState() {
  return (
    <div className="space-y-3 rounded-[14px] border border-[#E5E0D8] bg-[#FFFEFB] p-5 dark:border-hairline-dark dark:bg-panel-dark">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle dark:text-cream-500">
        When business state is not set
      </p>
      <HrWarningBanner
        title="Cannot import public holidays yet"
        description="Add your business state in Settings first. Without a state, we cannot fetch the correct Malaysia public holiday calendar for your company."
      />
      <div className="flex items-center justify-between rounded-[10px] bg-[#F2EDE3] px-4 py-3 dark:bg-hairline-dark/40">
        <span className="text-[13px] font-semibold text-ink-subtle dark:text-cream-500">
          Import from Malaysia calendar
        </span>
        <span className="text-[11px] font-semibold text-ink-muted dark:text-cream-400">
          Disabled
        </span>
      </div>
    </div>
  );
}
