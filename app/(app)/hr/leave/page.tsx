import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Stethoscope } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { HrLeaveCreateForm } from "@/components/hr/HrLeaveCreateForm";
import { HrLeaveStatusActions } from "@/components/hr/HrLeaveStatusActions";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { KpiTileBig } from "@/components/marketing/dashboard/KpiTileBig";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployees, loadHrLeaveRecords } from "@/lib/hr/load";

export const metadata = { title: "Leave" };
export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

export default async function LeavePage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-ink-muted dark:text-cream-400">
          You do not have access to leave records.
        </CardBody>
      </Card>
    );
  }

  const [employees, leave] = await Promise.all([
    loadHrEmployees(user.businessId),
    loadHrLeaveRecords(user.businessId),
  ]);
  const pendingCount = leave.filter((row) => row.status === "pending").length;
  const approvedCount = leave.filter((row) => row.status === "approved").length;
  const mcCount = leave.filter((row) => row.leave_type === "mc").length;

  return (
    <div className="space-y-6">
      <Link
        href="/hr"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink dark:text-cream-400 dark:hover:text-cream-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to HR
      </Link>

      <PageHeader
        eyebrow="HR"
        title="Leave tracker"
        description="Record and approve annual leave, emergency leave, and MC records."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTileBig
          label="Pending"
          value={String(pendingCount)}
          sublabel="waiting for approval"
          tone={pendingCount > 0 ? "warning" : "success"}
        />
        <KpiTileBig
          label="Approved"
          value={String(approvedCount)}
          sublabel="approved leave records"
          tone="brand"
        />
        <KpiTileBig
          label="MC records"
          value={String(mcCount)}
          sublabel="medical certificates"
          tone="accent"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-cream-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-hairline-dark">
            <div>
              <h2 className="text-base font-semibold text-ink dark:text-cream-100">
                Leave records
              </h2>
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                {leave.length} records across annual leave, emergency leave, and MC.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                <Clock3 className="h-3.5 w-3.5" />
                {pendingCount} pending
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {approvedCount} approved
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-cream-100/60 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:bg-hairline-dark/30 dark:text-cream-400">
                <tr>
                  <th className="px-5 py-3 text-left">Employee</th>
                  <th className="px-3 py-3 text-left">Type</th>
                  <th className="px-3 py-3 text-left">Dates</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 dark:divide-hairline-dark">
                {leave.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-ink-muted dark:text-cream-400"
                    >
                      No leave records yet.
                    </td>
                  </tr>
                ) : (
                  leave.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink dark:text-cream-100">
                          {row.hr_employees?.full_name ?? "Employee"}
                        </p>
                        <p className="text-xs text-ink-muted dark:text-cream-400">
                          {row.hr_employees?.role_title ?? "HR record"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-ink-muted dark:text-cream-400">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-2 py-1 text-xs font-semibold text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                          {row.leave_type === "mc" ? (
                            <Stethoscope className="h-3 w-3" />
                          ) : (
                            <CalendarDays className="h-3 w-3" />
                          )}
                          {row.leave_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-muted dark:text-cream-400">
                        {fmtDate(row.start_date)} to {fmtDate(row.end_date)}
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold uppercase text-ink-muted dark:text-cream-400">
                        {row.status}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {row.status === "pending" ? (
                          <HrLeaveStatusActions leaveId={row.id} />
                        ) : (
                          <span className="text-xs text-ink-muted dark:text-cream-400">
                            Decided
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <SectionCard
          title="Record leave"
          subtitle="Manual entry for owner, manager, or HR officer."
          action={<CalendarDays className="h-4 w-4 text-brand-700 dark:text-brand-200" />}
        >
          <HrLeaveCreateForm employees={employees} />
        </SectionCard>
      </div>
    </div>
  );
}
