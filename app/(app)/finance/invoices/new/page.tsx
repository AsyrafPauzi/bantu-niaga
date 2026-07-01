import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FinanceInvoiceComposer } from "@/components/finance/FinanceInvoiceComposer";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { nextFinanceInvoiceNumber } from "@/lib/finance/helpers";
import { loadBusiness } from "@/lib/settings/business";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { FinanceCustomerRow } from "@/lib/finance/schemas";

export const metadata = { title: "New invoice" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "finance")) redirect("/home");

  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/home");

  const admin = createServiceRoleClient();
  const [customersRes, nextNumber] = await Promise.all([
    admin
      .from("customers")
      .select(
        "id, business_id, name, phone_e164, email, address, notes, created_at, updated_at",
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    nextFinanceInvoiceNumber(admin, user.businessId),
  ]);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-8">
      <Link
        href="/finance/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        All invoices
      </Link>

      <FinanceInvoiceComposer
        customers={(customersRes.data ?? []) as unknown as FinanceCustomerRow[]}
        nextNumberPreview={nextNumber}
        defaultInvoiceDate={today}
        idcompany={business.idcompany}
        businessName={business.name}
        duitnowId={business.duitnow_id}
        appUrl={appUrl}
      />
    </div>
  );
}
