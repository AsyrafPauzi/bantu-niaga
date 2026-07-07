import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FinanceInvoiceComposer } from "@/components/finance/FinanceInvoiceComposer";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { loadInvoiceWithItems } from "@/lib/finance/invoice-db";
import { loadBusiness } from "@/lib/settings/business";
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

  const [invoice, customersRes] = await Promise.all([
    loadInvoiceWithItems(supabase, user.businessId, id),
    supabase
      .from("customers")
      .select(
        "id, business_id, name, phone_e164, email, address, notes, created_at, updated_at",
      )
      .eq("business_id", user.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  if (!invoice) notFound();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

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
        invoice={invoice}
        idcompany={business.idcompany}
        businessName={business.name}
        duitnowId={business.duitnow_id}
        appUrl={appUrl}
      />
    </div>
  );
}
