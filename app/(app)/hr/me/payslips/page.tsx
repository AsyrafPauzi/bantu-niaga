import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { MePageFrame } from "@/components/hr/me/MePageFrame";
import { MePayslipsPanel } from "@/components/hr/me/MePayslipsPanel";
import { formatMyr } from "@/lib/finance/schemas";
import {
  formatPayslipPeriodLabel,
  listHrPayslips,
  listHrPayslipsPage,
} from "@/lib/hr/payslips";
import { resolveStaffMePage } from "@/lib/hr/staff-self-service";
import { ADMIN_DEFAULT_PAGE_SIZE, parsePagination } from "@/lib/pagination";

export const metadata = { title: "Payslips" };
export const dynamic = "force-dynamic";

function parseYear(
  raw: string | string[] | undefined,
): number | "all" {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "all";
  const year = Number(value);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return "all";
  return year;
}

export default async function HrMePayslipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveStaffMePage();
  if (!ctx) return null;

  const { user, employee } = ctx;
  const params = await searchParams;
  const pagination = parsePagination(params, {
    defaultPageSize: ADMIN_DEFAULT_PAGE_SIZE,
  });
  const yearFilter = parseYear(params.year);

  const [pageResult, allForYears] = await Promise.all([
    listHrPayslipsPage(user.businessId, {
      employeeId: employee.id,
      year: yearFilter,
      from: pagination.from,
      to: pagination.to,
    }),
    listHrPayslips(user.businessId, {
      employeeId: employee.id,
      limit: 200,
    }),
  ]);

  const yearOptions = Array.from(
    new Set(
      allForYears.map((row) =>
        Number(row.period_start.slice(0, 4)),
      ),
    ),
  )
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => b - a);

  const latest = allForYears[0] ?? null;

  return (
    <MePageFrame
      pathname="/hr/me/payslips"
      title="Payslips"
      subtitle="Simple payslips from your recorded base salary"
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <ModuleHeroStat
            label="Total slips"
            value={allForYears.length}
            pillar="hr"
            iconClassName="text-[#0F766E] dark:text-teal-300"
          />
          <ModuleHeroStat
            label="Latest"
            value={
              latest
                ? formatPayslipPeriodLabel(latest.period_start)
                : "—"
            }
            pillar="hr"
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="Latest net"
            value={latest ? formatMyr(latest.net_myr) : "—"}
            pillar="hr"
            iconClassName="text-amber-700 dark:text-amber-300"
          />
        </div>
      }
    >
      <p className="rounded-xl border border-cream-200 bg-cream-50 px-3.5 py-2.5 text-xs text-ink-muted dark:border-hairline-dark dark:bg-panel-dark/60 dark:text-cream-400">
        These are not statutory payroll documents (EPF / SOCSO). Ask Finance if
        you need official slips.
      </p>

      <MePayslipsPanel
        rows={pageResult.rows}
        yearFilter={yearFilter}
        yearOptions={yearOptions}
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pageResult.total}
      />
    </MePageFrame>
  );
}
