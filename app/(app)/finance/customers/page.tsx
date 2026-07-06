import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FinanceCustomerPanel } from "@/components/finance/FinanceCustomerPanel";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { FinanceCustomerRow } from "@/lib/finance/schemas";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function FinanceCustomersPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "finance")) redirect("/home");

  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("customers")
    .select(
      "id, business_id, name, phone_e164, email, address, notes, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <Link
        href="/finance/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to invoices
      </Link>

      <PageHeader
        eyebrow="Finance"
        title="Customers"
        description="Save customer details once — pick them when creating invoices."
      />

      <FinanceCustomerPanel
        initialCustomers={(data ?? []) as unknown as FinanceCustomerRow[]}
      />
    </div>
  );
}
