import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { FinanceInvoicePanel } from "@/components/finance/FinanceInvoicePanel";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ListPagination } from "@/components/ui/list-pagination";
import { parsePagination } from "@/lib/pagination";
import { loadBusiness } from "@/lib/settings/business";
import type { FinanceInvoiceRow } from "@/lib/finance/schemas";

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
      <div className="space-y-6">
        <PageHeader
          eyebrow="Finance"
          title="Invoices"
          description="Create and share invoices with secure links."
        />
        <Card>
          <CardBody className="py-10 text-center text-sm text-ink-muted dark:text-cream-400">
            You don&apos;t have access to Finance.
          </CardBody>
        </Card>
      </div>
    );
  }

  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/home");

  const params = await searchParams;
  const pagination = parsePagination(params, { defaultPageSize: 20 });
  const supabase = await createSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("finance_invoices")
    .select(
      "id, business_id, number, share_hash, customer_id, customer_name, customer_email, " +
        "customer_phone, title, description, invoice_date, amount_myr, discount_myr, " +
        "discount_pct, tax_myr, tax_pct, shipping_myr, total_myr, status, due_date, notes, " +
        "paid_at, sent_at, created_at, updated_at",
      { count: "exact" },
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to);
  const total = count ?? data?.length ?? 0;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Invoices"
        description="Create invoices with line items, pick saved customers, share via WhatsApp or email."
      />

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
            idcompany={business.idcompany}
            businessName={business.name}
            appUrl={appUrl}
          />
          <ListPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            basePath="/finance/invoices"
            className="rounded-xl border border-cream-300 bg-white shadow-card"
          />
        </>
      )}
    </div>
  );
}
