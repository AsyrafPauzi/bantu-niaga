import { redirect } from "next/navigation";
import { OperationsAddServiceButton } from "@/components/operations/OperationsAddServiceButton";
import { OperationsServicePanel } from "@/components/operations/OperationsServicePanel";
import { OperationsSubpageShell } from "@/components/operations/OperationsSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { Card, CardBody } from "@/components/ui/card";
import { OperationsBackLink } from "@/components/operations/OperationsBackLink";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import { loadOperationsServicesPage } from "@/lib/operations/services";
import { parsePagination } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function ServicesPage({
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

  const admin = createServiceRoleClient();

  let pageData;
  try {
    pageData = await loadOperationsServicesPage(admin, user.businessId, {
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
            Failed to load services: {message}
          </CardBody>
        </Card>
      </div>
    );
  }

  const imageIds = pageData.services
    .map((s) => s.image_file_id)
    .filter(Boolean) as string[];
  const fileNames = await loadAdminFileNames(admin, user.businessId, imageIds);
  const services = pageData.services.map((s) => ({
    ...s,
    image_file_name: s.image_file_id
      ? (fileNames.get(s.image_file_id) ?? null)
      : null,
  }));

  const { summary } = pageData;

  const heroHeadline =
    summary.total === 0
      ? "Build your service menu"
      : `${summary.active} service${summary.active === 1 ? "" : "s"} ready to book`;

  const heroSub =
    summary.total === 0
      ? "Add duration and price — each service feeds your booking calendar."
      : "Search, edit, or pause services without leaving the list.";

  return (
    <OperationsSubpageShell
      headline={heroHeadline}
      subcopy={heroSub}
      variant="calm"
      action={<OperationsAddServiceButton />}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <ModuleHeroStat
            label="Active"
            value={summary.active}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Paused"
            value={summary.inactive}
            iconClassName="text-slate-600 dark:text-slate-300"
          />
          <ModuleHeroStat
            label="In catalog"
            value={summary.total}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
        </div>
      }
    >
      <OperationsServicePanel
        initialServices={services}
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pageData.total}
        searchQuery={searchQuery}
      />
    </OperationsSubpageShell>
  );
}
