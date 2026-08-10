import Link from "next/link";
import { redirect } from "next/navigation";
import { FinanceBackLink } from "@/components/finance/FinanceBackLink";
import { Card, CardBody } from "@/components/ui/card";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadCustomerStatement } from "@/lib/finance/statement";
import { formatFinanceShortDate, formatMyr } from "@/lib/finance/schemas";

export const metadata = { title: "Statement of Account" };
export const dynamic = "force-dynamic";

export default async function CustomerStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
          <CardBody className="py-10 text-center text-sm text-ink-muted">
            You don&apos;t have access to Finance.
          </CardBody>
        </Card>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const statement = await loadCustomerStatement(supabase, user.businessId, id);
  if (!statement) redirect("/finance/customers");

  const { customer, invoices, summary } = statement;

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <FinanceBackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink dark:text-cream-100">
            Statement of Account
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
            {customer.name}
          </p>
        </div>
        <a
          href={`/api/finance/customers/${encodeURIComponent(id)}/statement/pdf`}
          className="inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Download PDF
        </a>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase text-ink-muted">Total billed</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {formatMyr(summary.total_billed_myr)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase text-ink-muted">Paid</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-status-success">
              {formatMyr(summary.total_paid_myr)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase text-ink-muted">Outstanding</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-accent-700">
              {formatMyr(summary.outstanding_myr)}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="border-b border-cream-200 bg-cream-50 text-left text-xs uppercase text-ink-muted dark:border-hairline-dark dark:bg-panel-dark/60">
              <tr>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                    No invoices for this customer yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-cream-100 dark:border-hairline-dark"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/finance/invoices/${inv.id}/edit`}
                        className="font-medium text-brand-700 hover:underline dark:text-brand-200"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatFinanceShortDate(inv.invoice_date)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {inv.due_date ? formatFinanceShortDate(inv.due_date) : "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{inv.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatMyr(Number(inv.total_myr))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
