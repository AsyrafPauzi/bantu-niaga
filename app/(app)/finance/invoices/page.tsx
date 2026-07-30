import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { FinanceInvoicePanel } from "@/components/finance/FinanceInvoicePanel";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parsePagination } from "@/lib/pagination";
import { loadBusiness } from "@/lib/settings/business";
import { loadFinanceInvoicesSummary } from "@/lib/finance/invoices-summary";
import {
  FINANCE_INVOICE_STATUSES,
  type FinanceInvoiceRow,
} from "@/lib/finance/schemas";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "finance")) {
    return (
      <div className="space-y-4 pb-20 lg:pb-0">
        <p className="text-sm text-ink-muted dark:text-cream-400">
          You don&apos;t have access to Finance.
        </p>
      </div>
    );
  }

  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/home");

  const params = await searchParams;
  const pagination = parsePagination(params, { defaultPageSize: 10 });
  const kindParam = typeof params.kind === "string" ? params.kind : undefined;
  const documentKind =
    kindParam === "quote" || kindParam === "invoice" ? kindParam : "all";
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;
  const statusFilter = FINANCE_INVOICE_STATUSES.includes(
    statusParam as (typeof FINANCE_INVOICE_STATUSES)[number],
  )
    ? (statusParam as (typeof FINANCE_INVOICE_STATUSES)[number])
    : "all";

  const supabase = await createSupabaseServerClient();

  let listQuery = supabase
    .from("finance_invoices")
    .select(
      "id, business_id, number, share_hash, customer_id, customer_name, customer_email, " +
        "customer_phone, title, description, invoice_date, amount_myr, discount_myr, " +
        "discount_pct, tax_myr, tax_pct, shipping_myr, total_myr, status, due_date, notes, " +
        "paid_at, sent_at, document_kind, show_duitnow, converted_from_id, created_at, updated_at",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);

  if (documentKind !== "all") {
    listQuery = listQuery.eq("document_kind", documentKind);
  }
  if (statusFilter !== "all") {
    listQuery = listQuery.eq("status", statusFilter);
  }

  const [{ data, error, count }, summary] = await Promise.all([
    listQuery,
    loadFinanceInvoicesSummary(supabase, user.businessId),
  ]);
  const total = count ?? data?.length ?? 0;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <Link
        href="/finance"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Finance dashboard
      </Link>

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load invoices: {error.message}
          </CardBody>
        </Card>
      ) : (
        <>
          <FinanceInvoicePanel
            initialInvoices={(data ?? []) as unknown as FinanceInvoiceRow[]}
            summary={summary}
            idcompany={business.idcompany}
            businessName={business.name}
            appUrl={appUrl}
            documentKind={documentKind}
            statusFilter={statusFilter}
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
          />
        </>
      )}
    </div>
  );
}
