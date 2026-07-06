import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { OperationsOrderBoard } from "@/components/operations/OperationsOrderBoard";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  OperationsOrderRow,
  OperationsSupplierRow,
} from "@/lib/operations/schemas";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const ORDER_SELECT =
  "id, business_id, number, customer_name, customer_phone, title, description, " +
  "status, due_date, amount_myr, supplier_id, notes, completed_at, " +
  "created_by, created_at, updated_at";

export default async function OrdersPage() {
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

  const [{ data: orders, error }, { data: suppliers }] = await Promise.all([
    supabase
      .from("operations_orders")
      .select(ORDER_SELECT)
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("operations_suppliers")
      .select("id, business_id, name, contact_name, phone, email, address, payment_terms, notes, created_by, created_at, updated_at")
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  const rows = (orders ?? []) as unknown as OperationsOrderRow[];
  const supplierRows = (suppliers ?? []) as unknown as OperationsSupplierRow[];

  const nameLookup = new Map(supplierRows.map((s) => [s.id, s.name]));
  const enriched = rows.map((r) => ({
    ...r,
    supplier_name: r.supplier_id
      ? (nameLookup.get(r.supplier_id) ?? null)
      : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Orders"
        description="Track customer jobs from To do → In progress → Done. Tap a card to advance it."
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load orders: {error.message}
          </CardBody>
        </Card>
      ) : (
        <OperationsOrderBoard
          initialOrders={enriched}
          suppliers={supplierRows}
        />
      )}
    </div>
  );
}
