import Link from "next/link";
import type { HrLeaveRow } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeLabel,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";

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
}

export function HrLeaveRecordRow({ row, showStatus = false }: HrLeaveRecordRowProps) {
  const reason = row.reason?.trim() ? row.reason.trim() : "—";
  const hasMcDocument =
    row.leave_type === "mc" && Boolean(row.mc_document_path && row.mc_document_name);

  return (
    <div className="border-b border-cream-200 py-3 last:border-0 dark:border-hairline-dark">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
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
          <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">
            {leaveTypeLabel(row.leave_type)} · {fmtDate(row.start_date)}
            {row.end_date !== row.start_date ? ` – ${fmtDate(row.end_date)}` : ""}
          </p>
        </div>
        {showStatus ? (
          <span className="shrink-0 rounded-full bg-cream-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted dark:bg-hairline-dark/60 dark:text-cream-400">
            {statusLabel(row.status)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
        <span className="font-medium text-ink dark:text-cream-300">Reason:</span>{" "}
        {reason}
      </p>
      {row.leave_type === "mc" ? (
        <p className="mt-1 text-xs">
          {hasMcDocument ? (
            <>
              <span className="font-medium text-ink-muted dark:text-cream-400">
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
            <span className="text-ink-muted dark:text-cream-500">
              MC document: —
            </span>
          )}
        </p>
      ) : null}
    </div>
  );
}
