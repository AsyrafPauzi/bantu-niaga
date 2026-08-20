import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FinanceBackLink } from "@/components/finance/FinanceBackLink";
import { FinanceInvoicePanel } from "@/components/finance/FinanceInvoicePanel";
import { FinanceSubpageShell } from "@/components/finance/FinanceSubpageShell";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { Card, CardBody } from "@/components/ui/card";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parsePagination } from "@/lib/pagination";
import { loadBusiness } from "@/lib/settings/business";
import { loadFinanceInvoicesSummary } from "@/lib/finance/invoices-summary";
import { invoiceSubpageHero } from "@/lib/finance/subpage-hero";
import { formatMyr } from "@/lib/finance/schemas";
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
  const t = await getTranslations("finance");
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/sign-in");
    throw error;
  }

  if (!can(user.role, "finance")) {
    return (
      <div className="space-y-4">
        <FinanceBackLink />
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              {t("noAccess")}
            </p>
          </CardBody>
        </Card>
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
  const customerIdFilter =
    typeof params.customer_id === "string" ? params.customer_id.trim() : "";

  const supabase = await createSupabaseServerClient();

  let customerFilterName: string | null = null;
  if (customerIdFilter) {
    const { data: customerRow } = await supabase
      .from("customers")
      .select("name")
      .eq("business_id", user.businessId)
      .eq("id", customerIdFilter)
      .maybeSingle();
    customerFilterName =
      typeof customerRow?.name === "string" ? customerRow.name : null;
  }

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
  if (customerIdFilter) {
    listQuery = listQuery.eq("customer_id", customerIdFilter);
  }

  const [{ data, error, count }, summary] = await Promise.all([
    listQuery,
    loadFinanceInvoicesSummary(
      supabase,
      user.businessId,
      customerIdFilter ? { customerId: customerIdFilter } : undefined,
    ),
  ]);
  const total = count ?? data?.length ?? 0;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const hero = invoiceSubpageHero(summary);

  if (error) {
    return (
      <div className="space-y-4">
        <FinanceBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load invoices: {error.message}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <FinanceSubpageShell
      headline={hero.headline}
      subcopy={hero.subcopy}
      variant={hero.variant}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label={t("statOutstanding")}
            value={formatMyr(summary.outstanding_myr)}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label={t("statAwaitingPay")}
            value={summary.sent_count}
            iconClassName="text-rose-700 dark:text-rose-300"
          />
          <ModuleHeroStat
            label={t("statDrafts")}
            value={summary.draft_count}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label={t("statOpenQuotes")}
            value={summary.quote_count}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
        </div>
      }
    >
      <FinanceInvoicePanel
        initialInvoices={(data ?? []) as unknown as FinanceInvoiceRow[]}
        summary={summary}
        idcompany={business.idcompany}
        businessName={business.name}
        appUrl={appUrl}
        documentKind={documentKind}
        statusFilter={statusFilter}
        customerIdFilter={customerIdFilter || undefined}
        customerFilterName={customerFilterName}
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={total}
        shellMode
      />
    </FinanceSubpageShell>
  );
}
