import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Link2, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { HrLeaveCreateForm } from "@/components/hr/HrLeaveCreateForm";
import { HrBackLink } from "@/components/hr/layout/hr-back-link";
import { HrFormColumns } from "@/components/hr/layout/hr-form-columns";
import { HrMobileSubnav } from "@/components/hr/layout/hr-mobile-subnav";
import { HrPageBody } from "@/components/hr/layout/hr-page-body";
import { HrPageHeader } from "@/components/hr/layout/hr-page-header";
import { HrPageShell } from "@/components/hr/layout/hr-page-shell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrEmployees } from "@/lib/hr/load";
import { LEAVE_TYPES } from "@/lib/hr/leave-labels";

export const metadata = { title: "Record leave" };
export const dynamic = "force-dynamic";

export default async function RecordLeavePage() {
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
          You do not have access to record leave.
        </CardBody>
      </Card>
    );
  }

  const employees = await loadHrEmployees(user.businessId);
  const activeCount = employees.filter((e) => e.status === "active").length;

  return (
    <HrPageShell
      header={
        <HrPageHeader
          title="Record leave"
          subtitle="Log annual, emergency, or medical leave for your team"
          helpHref="/more"
          action={
            <button
              type="submit"
              form="hr-leave-create"
              className="inline-flex items-center justify-center rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Record leave
            </button>
          }
        />
      }
    >
      <HrPageBody className="gap-5">
        <HrMobileSubnav />
        <HrBackLink href="/hr/leave" label="Back to Leave" />

        <div className="rounded-2xl border border-[#D5E2FB] bg-gradient-to-r from-[#EEF3FE] via-white to-[#FFF7ED] px-5 py-4 dark:border-brand-900/40 dark:from-brand-900/20 dark:via-panel-dark dark:to-accent-900/10">
          <p className="text-sm font-semibold text-ink dark:text-cream-100">
            Manager entry · {activeCount} active staff
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted dark:text-cream-400">
            Records appear on the Leave page for approval unless you approve them
            later. For MC, upload the medical certificate now so it stays on file.
          </p>
        </div>

        <HrFormColumns
          form={
            <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-sm dark:border-hairline-dark dark:bg-panel-dark sm:p-8">
              <HrLeaveCreateForm
                employees={employees}
                hideSubmit
                redirectTo="/hr/leave"
              />
            </div>
          }
          help={
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E5E0D8] bg-white p-5 dark:border-hairline-dark dark:bg-panel-dark">
                <h3 className="text-sm font-bold text-ink dark:text-cream-100">
                  Leave types at a glance
                </h3>
                <ul className="mt-3 space-y-3">
                  {LEAVE_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <li key={type.key} className="flex gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream-100 text-brand-700 dark:bg-hairline-dark dark:text-brand-200">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-ink dark:text-cream-100">
                            {type.short} · {type.label}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted dark:text-cream-400">
                            {type.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/40 dark:bg-amber-900/10">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <h3 className="text-sm font-bold text-ink dark:text-cream-100">
                      MC requires a document
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted dark:text-cream-400">
                      Upload PNG, JPEG, or PDF (max 2 MB). The file is stored
                      securely and linked to the leave record for audits.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D5E2FB] bg-[#EEF3FE] p-5 dark:border-brand-900/50 dark:bg-brand-900/20">
                <div className="flex items-start gap-3">
                  <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-200" />
                  <div>
                    <h3 className="text-sm font-bold text-ink dark:text-cream-100">
                      Staff self-service
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted dark:text-cream-400">
                      Prefer staff to apply themselves? Share a private WhatsApp
                      link from the Employees page instead.
                    </p>
                    <Link
                      href="/hr/employees"
                      className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
                    >
                      Go to Employees →
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E0D8] bg-[#FAF7F2] p-5 dark:border-hairline-dark dark:bg-surface-dark">
                <div className="flex items-start gap-3">
                  <CalendarPlus className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-200" />
                  <p className="text-xs leading-relaxed text-ink-muted dark:text-cream-400">
                    Add a clear <strong className="text-ink dark:text-cream-200">reason</strong>{" "}
                    — it shows on pending approvals as AL, EL, or MC so you can
                    decide faster.
                  </p>
                </div>
              </div>
            </div>
          }
        />

        <div className="flex justify-end gap-3 lg:hidden">
          <Link
            href="/hr/leave"
            className="inline-flex items-center justify-center rounded-[10px] border border-[#E5E0D8] px-4 py-2.5 text-[13px] font-semibold text-ink dark:border-hairline-dark dark:text-cream-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            form="hr-leave-create"
            className="inline-flex items-center justify-center rounded-[10px] bg-brand-500 px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            Record leave
          </button>
        </div>
      </HrPageBody>
    </HrPageShell>
  );
}
