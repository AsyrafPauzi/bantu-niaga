import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FinanceInvoiceComposer } from "@/components/finance/FinanceInvoiceComposer";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { nextFinanceInvoiceNumber } from "@/lib/finance/helpers";
import {
  loadOperationsProductsForFinance,
  loadRecentBilledCustomers,
} from "@/lib/finance/invoice-composer-context";
import { loadBusiness } from "@/lib/settings/business";
import { isFinanceBillplzCheckoutEnabled } from "@/lib/finance/billplz-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FinanceCustomerRow } from "@/lib/finance/schemas";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: PageProps) {
  const sp = await searchParams;
  const isQuote = sp.kind === "quote";
  return { title: isQuote ? "New quote" : "New invoice" };
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const documentKind = sp.kind === "quote" ? "quote" : "invoice";
  const initialCustomerId =
    typeof sp.customer_id === "string" ? sp.customer_id : undefined;

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

  const supabase = await createSupabaseServerClient();
  const [customersRes, nextNumber, recentCustomers, products] =
    await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, business_id, name, phone_e164, email, address, notes, created_at, updated_at",
        )
        .eq("business_id", user.businessId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      nextFinanceInvoiceNumber(
        supabase,
        user.businessId,
        documentKind === "quote" ? "QUO" : "INV",
      ),
      loadRecentBilledCustomers(supabase, user.businessId),
      loadOperationsProductsForFinance(supabase, user.businessId),
    ]);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const today = new Date().toISOString().slice(0, 10);

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
        nextNumberPreview={nextNumber}
        defaultInvoiceDate={today}
        initialCustomerId={initialCustomerId}
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
        documentKind={documentKind}
        mergedHeader
      />
    </div>
  );
}
