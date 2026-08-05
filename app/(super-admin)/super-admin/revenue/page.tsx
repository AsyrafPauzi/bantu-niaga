import Link from "next/link";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import { PageBody } from "@/components/super-admin/primitives";
import { ListPagination } from "@/components/ui/list-pagination";
import { paginateArray, parsePagination } from "@/lib/pagination";
import { loadRevenueDashboard } from "@/lib/super-admin/revenue";
import { loadNadiaSettings } from "@/lib/super-admin/nadia-load";
import { RevenueDashboardClient } from "@/components/super-admin/revenue/RevenueDashboardClient";
import { NadiaPanel } from "@/components/super-admin/analyst/NadiaPanel";

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

  const [revenue, nadiaSettings] = await Promise.all([
    loadRevenueDashboard(),
    loadNadiaSettings(),
  ]);

  const { items: topTenantsPage, total: topTenantsTotal } = paginateArray(
    revenue.topTenants,
    tenantPagination.page,
    tenantPagination.pageSize,
  );

  return (
    <>
      <PageTopbar
        title="Revenue command center"
        subtitle="MRR, collected cash, and billing breakdown — live platform data"
        right={
          <Link
            href="/super-admin/ai-agents/nadia"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
          >
            Configure Nadia
          </Link>
        }
      />
      <PageBody>
        <RevenueDashboardClient
          revenue={{
            ...revenue,
            topTenants: topTenantsPage,
          }}
          tenantPage={tenantPagination.page}
          tenantPageSize={tenantPagination.pageSize}
          tenantTotal={topTenantsTotal}
        />
        <ListPagination
          page={tenantPagination.page}
          pageSize={tenantPagination.pageSize}
          total={topTenantsTotal}
          basePath="/super-admin/revenue"
          pageKey="tenantPage"
          className="rounded-lg border border-cream-300 bg-white"
        />
      </PageBody>
      <NadiaPanel initialSettings={nadiaSettings} />
    </>
  );
}
