import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import {
  AdminOverviewPanel,
  AdminOverviewRow,
} from "@/components/admin/AdminOverviewPanel";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
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
import { cn } from "@/lib/utils/cn";

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
            iconClassName="text-orange-700 dark:text-orange-300"
          />
          <ModuleHeroStat
            label="Total"
            value={formatMyr(history.salesMyr)}
            hint={
              period === "today"
                ? "Today"
                : period === "week"
                  ? "Last 7 days"
                  : "This month"
            }
            icon={Receipt}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        {(["today", "week", "month"] as const).map((p) => (
          <Link
            key={p}
            href={periodHref(p)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
              period === p
                ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                : "border-cream-300 text-ink-muted hover:border-brand-300 dark:border-hairline-dark",
            )}
          >
            {p === "today" ? "Today" : p === "week" ? "This week" : "This month"}
          </Link>
        ))}
      </div>

      <AdminOverviewPanel
        title="Receipts"
        subtitle={
          period === "today"
            ? "Today's POS sales"
            : period === "week"
              ? "Last 7 days"
              : "This month"
        }
      >
        {history.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            No sales in this period.{" "}
            <Link href="/sales/pos" className="font-semibold text-brand-700">
              Open POS
            </Link>
          </p>
        ) : (
          <ul>
            {history.rows.map((row) => (
              <li key={row.id}>
                <AdminOverviewRow
                  href={`/sales/receipts/${row.id}`}
                  title={`${row.sale_number} · ${row.customer_name?.trim() || "Walk-in"}`}
                  subtitle={new Date(row.created_at).toLocaleString("en-MY", {
                    timeZone: "Asia/Kuala_Lumpur",
                  })}
                  badge={
                    <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-semibold text-ink-muted dark:bg-hairline-dark">
                      {payLabel(row.payment_method)}
                    </span>
                  }
                  trailing={
                    <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      +{formatMyr(row.total_myr)}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </AdminOverviewPanel>
    </SalesSubpageShell>
  );
}
