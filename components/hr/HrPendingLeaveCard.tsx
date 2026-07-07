import Link from "next/link";
import type { HrLeaveRow } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeLabel,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { HrLeaveStatusActions } from "@/components/hr/HrLeaveStatusActions";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

interface HrPendingLeaveCardProps {
  row: HrLeaveRow;
}

export function HrPendingLeaveCard({ row }: HrPendingLeaveCardProps) {
  const reason = row.reason?.trim() ? row.reason.trim() : "—";
  const hasMcDocument =
    row.leave_type === "mc" && Boolean(row.mc_document_path && row.mc_document_name);

  return (
    <div className="rounded-xl border border-[#E5E0D8] bg-[#FFFEFB] p-4 dark:border-hairline-dark dark:bg-surface-dark">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink dark:text-cream-100">
              {row.hr_employees?.full_name ?? "Employee"}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveTypeBadgeClass(row.leave_type)}`}
            >
              {leaveTypeShort(row.leave_type)}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
            {leaveTypeLabel(row.leave_type)} · {fmtDate(row.start_date)}
            {row.end_date !== row.start_date ? ` – ${fmtDate(row.end_date)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 rounded-lg bg-cream-50 px-3 py-2.5 dark:bg-hairline-dark/30">
        <p className="text-xs text-ink-muted dark:text-cream-400">
          <span className="font-semibold text-ink dark:text-cream-300">Reason:</span>{" "}
          {reason}
        </p>
        {row.leave_type === "mc" ? (
          <p className="text-xs">
            {hasMcDocument ? (
              <>
                <span className="font-semibold text-ink-muted dark:text-cream-400">
                  MC document:{" "}
                </span>
                <Link
                  href={`/api/hr/leave/${row.id}/mc-document`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-200"
                >
                  {row.mc_document_name}
                </Link>
              </>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">
                MC document: not uploaded yet
              </span>
            )}
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        <HrLeaveStatusActions leaveId={row.id} />
      </div>
    </div>
  );
}
