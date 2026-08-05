import { redirect } from "next/navigation";
import { OperationsProductPanel } from "@/components/operations/OperationsProductPanel";
import { OperationsSubpageShell } from "@/components/operations/OperationsSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { Card, CardBody } from "@/components/ui/card";
import { OperationsBackLink } from "@/components/operations/OperationsBackLink";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import { loadOperationsProductsPage } from "@/lib/operations/products";
import {
  getCategoryPresetsForBusiness,
  mergeCategoryPresets,
  normalizeBusinessType,
} from "@/lib/operations/vertical";
import { parsePagination } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({
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
  const category =
    typeof params.category === "string" ? params.category : "all";
  const lowStockOnly = params.low_stock === "1";
  const highlightProductId =
    typeof params.product === "string" ? params.product : null;

  const admin = createServiceRoleClient();
  let pageData;
  let businessType = "other" as ReturnType<typeof normalizeBusinessType>;
  try {
    const [{ data: business }, loadedPage] = await Promise.all([
      admin
        .from("businesses")
        .select("business_type")
        .eq("id", user.businessId)
        .maybeSingle(),
      loadOperationsProductsPage(admin, user.businessId, {
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: searchQuery || undefined,
        category,
        lowStockOnly,
      }),
    ]);
    businessType = normalizeBusinessType(business?.business_type);
    pageData = loadedPage;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed.";
    return (
      <div className="space-y-4">
        <OperationsBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load products: {message}
          </CardBody>
        </Card>
      </div>
    );
  }

  const imageIds = pageData.products
    .map((p) => p.image_file_id)
    .filter(Boolean) as string[];
  const specIds = pageData.products
    .map((p) => p.spec_file_id)
    .filter(Boolean) as string[];
  const fileNames = await loadAdminFileNames(
    admin,
    user.businessId,
    [...imageIds, ...specIds],
  );
  const enrichedProducts = pageData.products.map((p) => ({
    ...p,
    image_file_name: p.image_file_id
      ? (fileNames.get(p.image_file_id) ?? null)
      : null,
    spec_file_name: p.spec_file_id
      ? (fileNames.get(p.spec_file_id) ?? null)
      : null,
  }));

  const categoryPresets = mergeCategoryPresets(
    getCategoryPresetsForBusiness(businessType),
    pageData.categories,
  );

  const { summary } = pageData;
  const heroHeadline =
    summary.total === 0
      ? "Your shelf is empty — let's stock it"
      : summary.low_stock > 0
        ? `${summary.low_stock} item${summary.low_stock === 1 ? "" : "s"} running low`
        : `${summary.active} active product${summary.active === 1 ? "" : "s"} ready for POS`;

  const heroSub =
    summary.total === 0
      ? "Add SKUs with price and stock — they sync straight to Sales POS and orders."
      : summary.low_stock > 0
        ? "Tap −/+ on a row to adjust stock, or filter by low stock to see what needs a top-up."
        : "Search, filter by category, and tweak stock right from the list.";

  return (
    <OperationsSubpageShell
      headline={heroHeadline}
      subcopy={heroSub}
      variant={summary.low_stock > 0 ? "attention" : "calm"}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <ModuleHeroStat
            label="Active"
            value={summary.active}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Low stock"
            value={summary.low_stock}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="In catalog"
            value={summary.total}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
        </div>
      }
    >
      <OperationsProductPanel
        initialProducts={enrichedProducts}
        allCategories={pageData.categories}
        categoryPresets={categoryPresets}
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pageData.total}
        searchQuery={searchQuery}
        categoryFilter={category}
        lowStockOnly={lowStockOnly}
        highlightProductId={highlightProductId}
      />
    </OperationsSubpageShell>
  );
}
