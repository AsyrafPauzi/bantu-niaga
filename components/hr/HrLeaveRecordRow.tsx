import Link from "next/link";
import type { HrLeaveRow } from "@/lib/hr/load";
import { leaveTypeRequiresDocument } from "@/lib/hr/schemas";
import { HrLeaveManageActions } from "@/components/hr/HrLeaveManageActions";
import {
  leaveTypeBadgeClass,
  leaveTypeLabel,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { cn } from "@/lib/utils/cn";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface HrLeaveRecordRowProps {
  row: HrLeaveRow;
  showStatus?: boolean;
  hideEmployeeName?: boolean;
  showManageActions?: boolean;
}

export function HrLeaveRecordRow({
  row,
  showStatus = false,
  hideEmployeeName = false,
  showManageActions = false,
}: HrLeaveRecordRowProps) {
  const reason = row.reason?.trim() ? row.reason.trim() : "—";
  const hasSupportingDocument =
    leaveTypeRequiresDocument(row.leave_type) &&
    Boolean(row.mc_document_path && row.mc_document_name);
  const docLabel =
    row.leave_type === "mc" ? "MC document" : "Supporting document";

  return (
    <div className="border-b border-cream-200 py-3 last:border-0 dark:border-hairline-dark">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {!hideEmployeeName ? (
              <p className="text-sm font-semibold text-ink dark:text-cream-100">
                {row.hr_employees?.full_name ?? "Employee"}
              </p>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveTypeBadgeClass(row.leave_type)}`}
            >
              {leaveTypeShort(row.leave_type)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            {leaveTypeLabel(row.leave_type)} · {fmtDate(row.start_date)}
            {row.end_date !== row.start_date ? ` – ${fmtDate(row.end_date)}` : ""}
          </p>
        </div>
        {showStatus ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
              row.status === "approved"
                ? "bg-teal-50 text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-300"
                : row.status === "pending"
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  : "bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
            )}
          >
            {statusLabel(row.status)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
        <span className="font-medium text-ink dark:text-cream-300">Reason:</span>{" "}
        {reason}
      </p>
      {leaveTypeRequiresDocument(row.leave_type) ? (
        <p className="mt-1 text-xs">
          {hasSupportingDocument ? (
            <>
              <span className="font-medium text-ink-muted dark:text-cream-400">
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
            <span className="text-ink-muted dark:text-cream-500">
              {docLabel}: —
            </span>
          )}
        </p>
      ) : null}
      {showManageActions ? <HrLeaveManageActions row={row} /> : null}
    </div>
  );
}
