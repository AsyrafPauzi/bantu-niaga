import Link from "next/link";
import { notFound } from "next/navigation";
import { MeLeaveCancelButton } from "@/components/hr/me/MeLeaveList";
import { MePageFrame } from "@/components/hr/me/MePageFrame";
import { loadStaffMeLeaveRecord } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeLabel,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Leave request" };
export const dynamic = "force-dynamic";

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

function statusChip(status: string): string {
  if (status === "approved") {
    return "bg-teal-50 text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-200";
  }
  if (status === "pending") {
    return "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (status === "rejected") {
    return "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200";
  }
  return "bg-cream-100 text-ink-muted dark:bg-hairline-dark dark:text-cream-400";
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function HrMeLeaveDetailPage({ params }: PageProps) {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const { id } = await params;
  const leave = await loadStaffMeLeaveRecord(
    ctx.user.businessId,
    ctx.employee.id,
    id,
  );
  if (!leave) notFound();

  const hasMcDocument =
    leave.leave_type === "mc" &&
    Boolean(leave.mc_document_path && leave.mc_document_name);

  return (
    <MePageFrame
      pathname={`/hr/me/leave/${id}`}
      title="Leave request"
      subtitle={`Submitted ${fmtDate(leave.created_at.slice(0, 10))}`}
    >
      <div className="space-y-4 rounded-2xl border border-cream-200 bg-white p-4 sm:p-5 dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${leaveTypeBadgeClass(leave.leave_type)}`}
          >
            {leaveTypeShort(leave.leave_type)}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-semibold",
              statusChip(leave.status),
            )}
          >
            {statusLabel(leave.status)}
          </span>
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Type
            </dt>
            <dd className="mt-1 font-medium text-ink dark:text-cream-100">
              {leaveTypeLabel(leave.leave_type)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Dates
            </dt>
            <dd className="mt-1 font-medium text-ink dark:text-cream-100">
              {fmtDate(leave.start_date)}
              {leave.end_date !== leave.start_date
                ? ` – ${fmtDate(leave.end_date)}`
                : ""}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Reason
            </dt>
            <dd className="mt-1 text-ink dark:text-cream-100">
              {leave.reason?.trim() || "—"}
            </dd>
          </div>
          {leave.decision_note?.trim() ? (
            <div className="sm:col-span-2 rounded-xl border border-cream-200 bg-cream-50 px-3.5 py-3 dark:border-hairline-dark dark:bg-hairline-dark/40">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Manager note
              </dt>
              <dd className="mt-1 text-ink dark:text-cream-100">
                {leave.decision_note.trim()}
              </dd>
            </div>
          ) : null}
          {leave.leave_type === "mc" ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Supporting document
              </dt>
              <dd className="mt-1">
                {hasMcDocument ? (
                  <Link
                    href={`/api/hr/leave/${leave.id}/mc-document`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#0F766E] underline underline-offset-2 dark:text-teal-300"
                  >
                    {leave.mc_document_name}
                  </Link>
                ) : (
                  <span className="text-ink-muted">—</span>
                )}
              </dd>
            </div>
          ) : null}
        </dl>

        {leave.status === "pending" ? (
          <div className="border-t border-cream-200 pt-4 dark:border-hairline-dark">
            <p className="mb-3 text-xs text-ink-muted dark:text-cream-400">
              Still waiting for approval? You can cancel this request.
            </p>
            <MeLeaveCancelButton leaveId={leave.id} />
          </div>
        ) : null}
      </div>
    </MePageFrame>
  );
}
