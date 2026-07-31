import { redirect } from "next/navigation";
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
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { OperationsSupplierRow } from "@/lib/operations/schemas";

export const metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
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
    .from("operations_suppliers")
    .select(
      "id, business_id, name, contact_name, phone, email, address, " +
        "payment_terms, notes, admin_file_id, created_by, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const rows = (data ?? []) as unknown as OperationsSupplierRow[];
  const fileNames = await loadAdminFileNames(
    admin,
    user.businessId,
    rows.map((r) => r.admin_file_id).filter(Boolean) as string[],
  );
  const suppliers = rows.map((r) => ({
    ...r,
    admin_file_name: r.admin_file_id
      ? (fileNames.get(r.admin_file_id) ?? null)
      : null,
  }));

  const reachableCount = suppliers.filter(
    (s) => s.phone?.trim() || s.email?.trim(),
  ).length;
  const withTermsCount = suppliers.filter((s) =>
    s.payment_terms?.trim(),
  ).length;
  const withContractCount = suppliers.filter((s) => s.admin_file_id).length;

  const heroHeadline =
    suppliers.length === 0
      ? "Build your vendor rolodex"
      : `${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"} on file`;

  const heroSub =
    suppliers.length === 0
      ? "Add who you buy from — phone, terms, and contracts in one tap."
      : "Search vendors, call straight from the list, keep payment terms handy.";

  if (error) {
    return (
      <div className="space-y-4">
        <OperationsBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load suppliers: {error.message}
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
            label="Reachable"
            value={reachableCount}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="With terms"
            value={withTermsCount}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Contracts"
            value={withContractCount}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
        </div>
      }
    >
      <OperationsSupplierPanel initialSuppliers={suppliers} />
    </OperationsSubpageShell>
  );
}
