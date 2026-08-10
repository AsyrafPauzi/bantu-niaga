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

interface HrPendingLeaveCardProps {
  row: HrLeaveRow;
}

export function HrPendingLeaveCard({ row }: HrPendingLeaveCardProps) {
  const reason = row.reason?.trim() ? row.reason.trim() : "—";
  const requiresDoc = leaveTypeRequiresDocument(row.leave_type);
  const hasSupportingDocument =
    requiresDoc && Boolean(row.mc_document_path && row.mc_document_name);
  const docLabel =
    row.leave_type === "mc" ? "MC document" : "Supporting document";

  return (
    <div className="rounded-xl border border-cream-200 bg-white p-3 dark:border-hairline-dark dark:bg-panel-dark">
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
        {requiresDoc ? (
          <p className="text-xs">
            {hasSupportingDocument ? (
              <>
                <span className="font-semibold text-ink-muted dark:text-cream-400">
                  {docLabel}:{" "}
                </span>
                <Link
                  href={`/api/hr/leave/${row.id}/mc-document`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#0D9488] underline underline-offset-2 hover:text-[#0F766E] dark:text-teal-400"
                >
                  {row.mc_document_name}
                </Link>
              </>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">
                {docLabel}: not uploaded yet
              </span>
            )}
          </p>
        ) : null}
      </div>

      <HrLeaveManageActions row={row} />

      <div className="mt-3">
        <HrLeaveStatusActions leaveId={row.id} />
      </div>
    </div>
  );
}
