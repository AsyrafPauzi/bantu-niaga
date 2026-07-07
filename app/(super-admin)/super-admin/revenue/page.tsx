import Link from "next/link";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  Section,
  formatMyr,
} from "@/components/super-admin/primitives";
import { ListPagination } from "@/components/ui/list-pagination";
import { paginateArray, parsePagination } from "@/lib/pagination";
import { loadRevenueDashboard } from "@/lib/super-admin/revenue";

export const dynamic = "force-dynamic";

export default async function SuperAdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tenantPagination = parsePagination(params, {
    defaultPageSize: 10,
    pageKey: "tenantPage",
  });
  const revenue = await loadRevenueDashboard();
  const { items: topTenantsPage, total: topTenantsTotal } = paginateArray(
    revenue.topTenants,
    tenantPagination.page,
    tenantPagination.pageSize,
  );
  const arr = revenue.mrrTotalMyr * 12;
  const maxMonth = Math.max(...revenue.monthly.map((m) => m.totalMyr), 1);

  return (
    <>
      <PageTopbar
        title="Revenue dashboard"
        subtitle="MRR, collected cash, and invoice breakdown across all tenants"
      />
      <PageBody>
        <div className="flex flex-wrap gap-4">
          <KpiCard
            label="Total MRR"
            value={formatMyr(revenue.mrrTotalMyr)}
            delta={`${formatMyr(revenue.mrrSubscriptionMyr)} plans + ${formatMyr(revenue.mrrAddonMyr)} add-ons`}
            trend="up"
          />
          <KpiCard
            label="ARR projection"
            value={formatMyr(arr)}
            subtle="MRR × 12"
          />
          <KpiCard
            label="Collected (30d)"
            value={formatMyr(revenue.collectedLast30dMyr)}
            delta="paid invoices"
          />
          <KpiCard
            label="Collected (90d)"
            value={formatMyr(revenue.collectedLast90dMyr)}
            delta={`${revenue.paidInvoiceCount} paid total`}
          />
          <KpiCard
            label="Pending invoices"
            value={formatMyr(revenue.pendingInvoicesMyr)}
            trend={revenue.pendingInvoicesMyr > 0 ? "down" : "flat"}
          />
        </div>

        <Section
          title="Monthly collected revenue"
          description="Paid platform invoices (subscriptions, add-ons, top-ups) by month."
        >
          <div className="space-y-2">
            {revenue.monthly.map((row) => (
              <div key={row.month} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs font-semibold text-ink-muted">
                  {row.label}
                </span>
                <div className="flex-1 h-7 rounded-md bg-cream-200 overflow-hidden">
                  <div
                    className="h-full rounded-md bg-brand-500"
                    style={{
                      width: `${Math.max(4, (row.totalMyr / maxMonth) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-sm font-semibold text-ink">
                  {formatMyr(row.totalMyr)}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="By invoice type" description="Lifetime paid totals.">
            <ul className="space-y-2">
              {revenue.byKind.length === 0 ? (
                <li className="text-sm text-ink-muted">No paid invoices yet.</li>
              ) : (
                revenue.byKind.map((row) => (
                  <li
                    key={row.kind}
                    className="flex items-center justify-between rounded-lg border border-cream-300 bg-cream-50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-ink">{row.label}</span>
                    <span className="text-sm font-bold text-ink">
                      {formatMyr(row.amountMyr)}{" "}
                      <span className="font-normal text-ink-muted">
                        · {row.count}
                      </span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Section>

          <Section title="Top paying tenants" description="Paid invoice totals.">
            <ul className="space-y-2">
              {topTenantsPage.length === 0 ? (
                <li className="text-sm text-ink-muted">No data yet.</li>
              ) : (
                topTenantsPage.map((t) => (
                  <li key={t.businessId}>
                    <Link
                      href={`/super-admin/businesses/${t.businessId}`}
                      className="flex items-center justify-between rounded-lg border border-cream-300 bg-white px-3 py-2 hover:bg-cream-50"
                    >
                      <span className="text-sm font-medium text-ink">{t.name}</span>
                      <span className="text-sm font-bold text-brand-700">
                        {formatMyr(t.amountMyr)}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
            <ListPagination
              page={tenantPagination.page}
              pageSize={tenantPagination.pageSize}
              total={topTenantsTotal}
              basePath="/super-admin/revenue"
              pageKey="tenantPage"
              className="mt-2 rounded-lg border border-cream-300 bg-white"
            />
          </Section>
        </div>
      </PageBody>
    </>
  );
}
