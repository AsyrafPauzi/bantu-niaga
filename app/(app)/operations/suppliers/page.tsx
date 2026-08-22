import { redirect } from "next/navigation";
import { OperationsAddSupplierButton } from "@/components/operations/OperationsAddSupplierButton";
import { OperationsSupplierPanel } from "@/components/operations/OperationsSupplierPanel";
import { OperationsSubpageShell } from "@/components/operations/OperationsSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { Card, CardBody } from "@/components/ui/card";
import { OperationsBackLink } from "@/components/operations/OperationsBackLink";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import { loadOperationsSuppliersPage } from "@/lib/operations/suppliers";
import { parsePagination } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!can(user.role, "operations")) {
    redirect("/home");
  }

  const params = await searchParams;
  const pagination = parsePagination(params, { defaultPageSize: 10 });
  const searchQuery = typeof params.q === "string" ? params.q.trim() : "";
  const highlightSupplierId =
    typeof params.supplier === "string" ? params.supplier : null;

  const admin = createServiceRoleClient();

  let pageData;
  try {
    pageData = await loadOperationsSuppliersPage(admin, user.businessId, {
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: searchQuery || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed.";
    return (
      <div className="space-y-4">
        <OperationsBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load suppliers: {message}
          </CardBody>
        </Card>
      </div>
    );
  }

  const fileNames = await loadAdminFileNames(
    admin,
    user.businessId,
    pageData.suppliers
      .map((r) => r.admin_file_id)
      .filter(Boolean) as string[],
  );
  const suppliers = pageData.suppliers.map((r) => ({
    ...r,
    admin_file_name: r.admin_file_id
      ? (fileNames.get(r.admin_file_id) ?? null)
      : null,
  }));

  const { summary } = pageData;
  const heroHeadline =
    summary.total === 0
      ? "Build your vendor rolodex"
      : `${summary.total} supplier${summary.total === 1 ? "" : "s"} on file`;

  const heroSub =
    summary.total === 0
      ? "Add who you buy from — phone, terms, and contracts in one tap."
      : "Search vendors, call straight from the list, keep payment terms handy.";

  return (
    <OperationsSubpageShell
      headline={heroHeadline}
      subcopy={heroSub}
      variant="calm"
      action={<OperationsAddSupplierButton />}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <ModuleHeroStat
            label="Reachable"
            value={summary.reachable}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="With terms"
            value={summary.with_terms}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Contracts"
            value={summary.with_contract}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
        </div>
      }
    >
      <OperationsSupplierPanel
        initialSuppliers={suppliers}
        highlightSupplierId={highlightSupplierId}
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pageData.total}
        searchQuery={searchQuery}
      />
    </OperationsSubpageShell>
  );
}
