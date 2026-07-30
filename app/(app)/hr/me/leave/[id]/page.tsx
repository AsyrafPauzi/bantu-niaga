import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/dashboard/section-card";
import { MeLeaveCancelButton } from "@/components/hr/me/MeLeaveList";
import { MeMobileSubnav } from "@/components/hr/me/MeMobileSubnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { loadStaffMeLeaveRecord } from "@/lib/hr/load";
import {
  leaveTypeBadgeClass,
  leaveTypeLabel,
  leaveTypeShort,
} from "@/lib/hr/leave-labels";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";

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
    <HrPageShell
      header={
        <HrPageHeader
          title="Leave request"
          subtitle={`Submitted ${fmtDate(leave.created_at.slice(0, 10))}`}
          action={
            <Link
              href="/hr/me"
              className="inline-flex rounded-[10px] border border-[#E5E0D8] bg-[#FAF7F2] px-3.5 py-2.5 text-[13px] font-semibold text-[#11328A] dark:border-hairline-dark dark:bg-panel-dark dark:text-brand-200"
            >
              ← Back
            </Link>
          }
        />
      }
    >
      <HrPageBody>
        <MeMobileSubnav pathname={`/hr/me/leave/${id}`} />

        <SectionCard title="Details" bodyClassName="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${leaveTypeBadgeClass(leave.leave_type)}`}
            >
              {leaveTypeShort(leave.leave_type)}
            </span>
            <span className="text-sm font-semibold text-ink dark:text-cream-100">
              {statusLabel(leave.status)}
            </span>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-ink-muted">Type</dt>
              <dd className="mt-0.5 text-ink dark:text-cream-100">
                {leaveTypeLabel(leave.leave_type)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-ink-muted">Dates</dt>
              <dd className="mt-0.5 text-ink dark:text-cream-100">
                {fmtDate(leave.start_date)}
                {leave.end_date !== leave.start_date
                  ? ` – ${fmtDate(leave.end_date)}`
                  : ""}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-ink-muted">Reason</dt>
              <dd className="mt-0.5 text-ink dark:text-cream-100">
                {leave.reason?.trim() || "—"}
              </dd>
            </div>
            {leave.decision_note?.trim() ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-ink-muted">
                  Manager note
                </dt>
                <dd className="mt-0.5 text-ink dark:text-cream-100">
                  {leave.decision_note.trim()}
                </dd>
              </div>
            ) : null}
            {leave.leave_type === "mc" ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase text-ink-muted">
                  MC document
                </dt>
                <dd className="mt-0.5">
                  {hasMcDocument ? (
                    <Link
                      href={`/api/hr/leave/${leave.id}/mc-document`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-200"
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
            <MeLeaveCancelButton leaveId={leave.id} />
          ) : null}
        </SectionCard>
      </HrPageBody>
    </HrPageShell>
  );
}
