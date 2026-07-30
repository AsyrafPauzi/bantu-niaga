import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FinanceInvoiceComposer } from "@/components/finance/FinanceInvoiceComposer";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { loadInvoiceWithItems } from "@/lib/finance/invoice-db";
import {
  loadOperationsProductsForFinance,
  loadRecentBilledCustomers,
} from "@/lib/finance/invoice-composer-context";
import { loadAdminFileNames } from "@/lib/admin/validate-admin-file";
import { loadBusiness } from "@/lib/settings/business";
import { isFinanceBillplzCheckoutEnabled } from "@/lib/finance/billplz-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FinanceCustomerRow } from "@/lib/finance/schemas";

export const metadata = { title: "Edit invoice" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: Props) {
  const { id } = await params;

  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "finance")) redirect("/home");

  const supabase = await createSupabaseServerClient();
  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/home");

  const [invoice, customersRes, recentCustomers, products] = await Promise.all([
    loadInvoiceWithItems(supabase, user.businessId, id),
    supabase
      .from("customers")
      .select(
        "id, business_id, name, phone_e164, email, address, notes, created_at, updated_at",
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    loadRecentBilledCustomers(supabase, user.businessId),
    loadOperationsProductsForFinance(supabase, user.businessId),
  ]);

  if (!invoice) notFound();

  if (invoice.admin_file_id) {
    const names = await loadAdminFileNames(supabase, user.businessId, [
      invoice.admin_file_id,
    ]);
    invoice.admin_file_name = names.get(invoice.admin_file_id) ?? null;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return (
    <div className="space-y-6">
      <Link
        href="/finance/invoices"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        All invoices
      </Link>

      <FinanceInvoiceComposer
        customers={(customersRes.data ?? []) as unknown as FinanceCustomerRow[]}
        invoice={invoice}
        recentCustomers={recentCustomers}
        products={products}
        idcompany={business.idcompany}
        businessName={business.name}
        duitnowId={business.duitnow_id}
        duitnowQrUrl={business.duitnow_qr_url}
        fpxEnabled={isFinanceBillplzCheckoutEnabled()}
        sstEnabled={business.sst_enabled}
        sstRatePct={Number(business.sst_rate_pct ?? 0)}
        appUrl={appUrl}
        mergedHeader
      />
    </div>
  );
}
