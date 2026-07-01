import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { OperationsSupplierPanel } from "@/components/operations/OperationsSupplierPanel";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operations_suppliers")
    .select(
      "id, business_id, name, contact_name, phone, email, address, " +
        "payment_terms, notes, created_by, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const rows = (data ?? []) as unknown as OperationsSupplierRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Suppliers"
        description="Your vendor contact list — phone, email, payment terms, all in one place."
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load suppliers: {error.message}
          </CardBody>
        </Card>
      ) : (
        <OperationsSupplierPanel initialSuppliers={rows} />
      )}
    </div>
  );
}
