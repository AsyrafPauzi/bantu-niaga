import Link from "next/link";
import type { HrLeaveRow } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeLabel,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { leaveTypeRequiresDocument } from "@/lib/hr/schemas";
import { HrLeaveManageActions } from "@/components/hr/HrLeaveManageActions";
import { HrLeaveStatusActions } from "@/components/hr/HrLeaveStatusActions";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

function fmtRange(start: string, end: string): string {
  if (start === end) return fmtDate(start);
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${fmtDate(end)}`;
  }
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

interface HrPendingLeaveCardProps {
  row: HrLeaveRow;
}

export function HrPendingLeaveCard({ row }: HrPendingLeaveCardProps) {
  const reason = row.reason?.trim() ? row.reason.trim() : null;
  const requiresDoc = leaveTypeRequiresDocument(row.leave_type);
  const hasSupportingDocument =
    requiresDoc && Boolean(row.mc_document_path && row.mc_document_name);
  const docLabel =
    row.leave_type === "mc" ? "MC" : "Doc";

  return (
    <div className="rounded-xl border border-cream-200 bg-white px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark">
      {/* Line 1 — name + type badge */}
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate text-sm font-semibold text-ink dark:text-cream-100">
          {row.hr_employees?.full_name ?? "Employee"}
        </p>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveTypeBadgeClass(row.leave_type)}`}
        >
          {leaveTypeShort(row.leave_type)}
        </span>
      </div>

      {/* Line 2 — type · dates · reason · doc */}
      <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-cream-400">
        {leaveTypeLabel(row.leave_type)} · {fmtRange(row.start_date, row.end_date)}
        {reason ? ` · ${reason}` : ""}
        {requiresDoc ? (
          <>
            {" · "}
            {hasSupportingDocument ? (
              <Link
                href={`/api/hr/leave/${row.id}/mc-document`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#0D9488] underline underline-offset-2 hover:text-[#0F766E] dark:text-teal-400"
              >
                {docLabel}
              </Link>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">
                {docLabel}: missing
              </span>
            )}
          </>
        ) : null}
      </p>

      {/* Line 3 — edit/delete + approve/reject */}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 [&>*]:mt-0">
        <HrLeaveManageActions row={row} />
        <HrLeaveStatusActions
          leaveId={row.id}
          employeeName={row.hr_employees?.full_name ?? "Employee"}
          leaveType={row.leave_type}
          startDate={row.start_date}
          endDate={row.end_date}
          phoneE164={row.hr_employees?.phone_e164 ?? null}
        />
      </div>
    </div>
  );
}
