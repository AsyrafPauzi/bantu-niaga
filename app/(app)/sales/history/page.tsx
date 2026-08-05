import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import {
  ModuleListPanel,
  ModuleListPanelFilters,
  ModuleListTable,
  ModuleListTableBody,
  ModuleListTableHead,
  MODULE_LIST_TABLE_ROW_CLASS,
} from "@/components/dashboard/module-list-panel";
import { ModuleListFilterChipLink } from "@/components/dashboard/module-list-search";
import { SalesPosExportButton } from "@/components/sales/SalesPosExportButton";
import { SalesSubpageShell } from "@/components/sales/SalesSubpageShell";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { formatMyr } from "@/lib/marketing/metrics";
import { canManageSalesCore } from "@/lib/sales/access";
import {
  loadSalesHistory,
  parseSalesHistoryPeriod,
} from "@/lib/sales/history";
import { historySubpageHero } from "@/lib/sales/subpage-hero";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Sales history" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function param(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = raw[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return "";
}

function payLabel(method: string): string {
  if (method === "cash") return "Cash";
  if (method === "duitnow_qr_static") return "DuitNow QR";
  return method;
}

export default async function SalesHistoryPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canManageSalesCore(user.role)) {
    redirect("/sales");
  }

  const raw = await searchParams;
  const period = parseSalesHistoryPeriod(param(raw, "period"));
  const supabase = await createSupabaseServerClient();
  const history = await loadSalesHistory(supabase, user.businessId, period);
  const hero = historySubpageHero({
    period,
    salesMyr: history.salesMyr,
    txnCount: history.txnCount,
  });

  function periodHref(next: "today" | "week" | "month") {
    return next === "today" ? "/sales/history" : `/sales/history?period=${next}`;
  }

  const periodLabel =
    period === "today"
      ? "Today"
      : period === "week"
        ? "This week"
        : "This month";

  return (
    <SalesSubpageShell
      headline={hero.headline}
      subcopy={hero.subcopy}
      variant={hero.variant}
      cta={<SalesPosExportButton period={period} disabled={history.txnCount === 0} />}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <ModuleHeroStat
            label="Receipts"
            value={String(history.txnCount)}
            hint="Completed sales"
            icon={Receipt}
            iconClassName="text-blue-700 dark:text-blue-300"
          />
          <ModuleHeroStat
            label="Total"
            value={formatMyr(history.salesMyr)}
            hint={periodLabel}
            icon={Receipt}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
        </div>
      }
    >
      <ModuleListPanel>
        <ModuleListPanelFilters>
          <nav
            aria-label="Filter by period"
            className="flex flex-wrap gap-2"
          >
            {(["today", "week", "month"] as const).map((p) => (
              <ModuleListFilterChipLink
                key={p}
                href={periodHref(p)}
                active={period === p}
                accent="blue"
                label={
                  p === "today"
                    ? "Today"
                    : p === "week"
                      ? "This week"
                      : "This month"
                }
              />
            ))}
          </nav>
          <p className="mt-3 text-xs font-medium text-[#2563EB] dark:text-blue-300">
            {history.txnCount} receipt{history.txnCount === 1 ? "" : "s"} ·{" "}
            {periodLabel.toLowerCase()}
          </p>
        </ModuleListPanelFilters>

        <ModuleListTable>
          <ModuleListTableHead>
            <tr>
              <th className="px-5 py-3 text-left">Receipt</th>
              <th className="px-3 py-3 text-left">Customer</th>
              <th className="px-3 py-3 text-left">Payment</th>
              <th className="px-3 py-3 text-left">When</th>
              <th className="px-5 py-3 text-right">Amount</th>
            </tr>
          </ModuleListTableHead>
          <ModuleListTableBody>
            {history.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-ink-muted dark:text-cream-400"
                >
                  No sales in this period.{" "}
                  <Link
                    href="/sales/pos"
                    className="font-semibold text-[#2563EB] hover:underline"
                  >
                    Open POS
                  </Link>
                </td>
              </tr>
            ) : (
              history.rows.map((row) => (
                <tr key={row.id} className={MODULE_LIST_TABLE_ROW_CLASS}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/sales/receipts/${row.id}`}
                      className="font-mono text-sm font-semibold text-ink hover:text-[#2563EB] dark:text-cream-100"
                    >
                      {row.sale_number}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-sm text-ink dark:text-cream-100">
                    {row.customer_name?.trim() || "Walk-in"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-semibold text-ink-muted dark:bg-hairline-dark dark:text-cream-400">
                      {payLabel(row.payment_method)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-muted dark:text-cream-400">
                    {new Date(row.created_at).toLocaleString("en-MY", {
                      timeZone: "Asia/Kuala_Lumpur",
                    })}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                    +{formatMyr(row.total_myr)}
                  </td>
                </tr>
              ))
            )}
          </ModuleListTableBody>
        </ModuleListTable>
      </ModuleListPanel>
    </SalesSubpageShell>
  );
}
