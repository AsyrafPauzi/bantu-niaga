import { redirect } from "next/navigation";
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
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { OperationsServiceRow } from "@/lib/operations/schemas";

export const metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
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

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("operations_services")
    .select(
      "id, business_id, name, description, duration_minutes, price_myr, " +
        "is_active, notes, image_file_id, created_by, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const rawServices = (data ?? []) as unknown as OperationsServiceRow[];
  const imageIds = rawServices
    .map((s) => s.image_file_id)
    .filter(Boolean) as string[];
  const fileNames = await loadAdminFileNames(
    admin,
    user.businessId,
    imageIds,
  );
  const services = rawServices.map((s) => ({
    ...s,
    image_file_name: s.image_file_id
      ? (fileNames.get(s.image_file_id) ?? null)
      : null,
  }));
  const activeCount = services.filter((s) => s.is_active).length;
  const inactiveCount = services.length - activeCount;

  const heroHeadline =
    services.length === 0
      ? "Build your service menu"
      : `${activeCount} service${activeCount === 1 ? "" : "s"} ready to book`;

  const heroSub =
    services.length === 0
      ? "Add duration and price — each service feeds your booking calendar."
      : "Search, edit, or pause services without leaving the list.";

  if (error) {
    return (
      <div className="space-y-4">
        <OperationsBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load services: {error.message}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <OperationsSubpageShell
      headline={heroHeadline}
      subcopy={heroSub}
      variant="calm"
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <ModuleHeroStat
            label="Active"
            value={activeCount}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Paused"
            value={inactiveCount}
            iconClassName="text-slate-600 dark:text-slate-300"
          />
          <ModuleHeroStat
            label="In catalog"
            value={services.length}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
        </div>
      }
    >
      <OperationsServicePanel initialServices={services} />
    </OperationsSubpageShell>
  );
}
