import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { OperationsProductPanel } from "@/components/operations/OperationsProductPanel";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OperationsProductRow } from "@/lib/operations/schemas";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
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
    .from("operations_products")
    .select(
      "id, business_id, sku, name, description, category, price_myr, " +
        "is_active, notes, created_by, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const rows = (data ?? []) as unknown as OperationsProductRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Products"
        description="Your product catalog — SKU, price, and category for orders and future POS."
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load products: {error.message}
          </CardBody>
        </Card>
      ) : (
        <OperationsProductPanel initialProducts={rows} />
      )}
    </div>
  );
}
