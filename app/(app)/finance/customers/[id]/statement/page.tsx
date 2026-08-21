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

  // Sort oldest → newest to compute running balance
  const sorted = [...invoices].sort(
    (a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime(),
  );

  let runningBalance = 0;
  type StatementRow = {
    key: string;
    date: string;
    txnType: string;
    details: string;
    href: string | null;
    amount: number;
    payment: number;
    balance: number;
  };

  // Each paid invoice becomes TWO rows: Invoice + Payment Received
  const rows: StatementRow[] = [];
  for (const inv of sorted) {
    const total = Number(inv.total_myr ?? 0);
    const isPaid = inv.status === "paid";
    const invoiceDetails = `${inv.number}${inv.due_date ? ` – due on ${formatFinanceShortDate(inv.due_date)}` : ""}`;
    const href = `/finance/invoices/${inv.id}/edit`;

    // Invoice row — balance goes up
    runningBalance += total;
    rows.push({
      key: `${inv.id}-invoice`,
      date: inv.invoice_date,
      txnType: "Invoice",
      details: invoiceDetails,
      href,
      amount: total,
      payment: 0,
      balance: runningBalance,
    });

    // Payment Received row — balance goes down (only if paid)
    if (isPaid) {
      const payDate = inv.paid_at ? inv.paid_at.slice(0, 10) : inv.invoice_date;
      runningBalance -= total;
      rows.push({
        key: `${inv.id}-payment`,
        date: payDate,
        txnType: "Payment Received",
        details: `${formatMyr(total)} for payment of ${inv.number}`,
        href: null,
        amount: 0,
        payment: total,
        balance: runningBalance,
      });
    }
  }

  // Display oldest first, newest last
  const displayRows = rows;

  const dateFrom = sorted[0]?.invoice_date ?? null;
  const dateTo = sorted[sorted.length - 1]?.invoice_date ?? null;
  const dateRange =
    dateFrom && dateTo
      ? `${formatFinanceShortDate(dateFrom)} to ${formatFinanceShortDate(dateTo)}`
      : null;

  return (
    <div className="space-y-4 pb-20 lg:pb-8">
      <FinanceBackLink />

      {/* ── Header block ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
        <div className="grid gap-6 p-6 sm:grid-cols-2">

          {/* Left – To (customer) */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              To
            </p>
            <p className="font-semibold text-ink dark:text-cream-100">{customer.name}</p>
            {customer.email ? (
              <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">{customer.email}</p>
            ) : null}
            {customer.phone_e164 ? (
              <p className="mt-0.5 text-sm text-ink-muted dark:text-cream-400">{customer.phone_e164}</p>
            ) : null}
            {customer.address ? (
              <p className="mt-0.5 whitespace-pre-line text-sm text-ink-muted dark:text-cream-400">
                {customer.address}
              </p>
            ) : null}
          </div>

          {/* Right – title + summary */}
          <div className="sm:text-right">
            <p className="text-2xl font-bold text-ink dark:text-cream-100">
              Statement of Accounts
            </p>
            {dateRange ? (
              <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">{dateRange}</p>
            ) : null}

            {/* Account Summary */}
            <div className="mt-4 inline-block w-full overflow-hidden rounded-lg border border-cream-200 dark:border-hairline-dark sm:w-auto sm:min-w-[280px]">
              <div className="bg-cream-100 px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink dark:bg-hairline-dark dark:text-cream-100">
                Account Summary
              </div>
              {(
                [
                  { label: "Opening Balance", value: 0 },
                  { label: "Invoiced Amount", value: summary.total_billed_myr },
                  { label: "Amount Paid", value: summary.total_paid_myr },
                  { label: "Balance Due", value: summary.outstanding_myr, strong: true },
                ] as { label: string; value: number; strong?: boolean }[]
              ).map(({ label, value, strong }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-8 border-t border-cream-200 px-4 py-2 text-sm dark:border-hairline-dark"
                >
                  <span className={strong ? "font-semibold text-ink dark:text-cream-100" : "text-ink-muted dark:text-cream-400"}>
                    {label}
                  </span>
                  <span className={strong ? "font-bold tabular-nums text-ink dark:text-cream-100" : "tabular-nums text-ink dark:text-cream-100"}>
                    {formatMyr(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Download PDF */}
      <div className="flex justify-end">
        <a
          href={`/api/finance/customers/${encodeURIComponent(id)}/statement/pdf`}
          className="inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Download PDF
        </a>
      </div>

      {/* ── Transaction table ─────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-cream-200 shadow-card dark:border-hairline-dark">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#2d2d2d] text-white dark:bg-cream-900">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Transactions</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Details</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Payments</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 dark:divide-hairline-dark">
              {/* Opening balance row */}
              <tr className="bg-white dark:bg-panel-dark">
                <td className="px-4 py-3 text-ink-muted dark:text-cream-400">—</td>
                <td className="px-4 py-3 font-medium text-ink dark:text-cream-100">***Opening Balance***</td>
                <td className="px-4 py-3 text-ink-muted dark:text-cream-400" />
                <td className="px-4 py-3 text-right tabular-nums text-ink-muted dark:text-cream-400">
                  {formatMyr(0)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-muted dark:text-cream-400" />
                <td className="px-4 py-3 text-right tabular-nums font-medium text-ink dark:text-cream-100">
                  {formatMyr(0)}
                </td>
              </tr>

              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-muted dark:text-cream-400">
                    No invoices for this customer yet.
                  </td>
                </tr>
              ) : (
                displayRows.map(({ key, date, txnType, details, href, amount, payment, balance }) => (
                  <tr
                    key={key}
                    className="bg-white hover:bg-cream-50 dark:bg-panel-dark dark:hover:bg-hairline-dark/20"
                  >
                    <td className="px-4 py-3 text-ink-muted dark:text-cream-400">
                      {formatFinanceShortDate(date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink dark:text-cream-100">{txnType}</td>
                    <td className="px-4 py-3 text-ink-muted dark:text-cream-400">
                      {href ? (
                        <Link href={href} className="text-brand-700 hover:underline dark:text-brand-200">
                          {details}
                        </Link>
                      ) : (
                        details
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink dark:text-cream-100">
                      {amount > 0 ? formatMyr(amount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink dark:text-cream-100">
                      {payment > 0 ? formatMyr(payment) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-ink dark:text-cream-100">
                      {formatMyr(balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Balance Due footer */}
            <tfoot>
              <tr className="border-t border-cream-200 bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark/60">
                <td colSpan={4} className="px-4 py-3" />
                <td className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-ink dark:text-cream-100">
                  Balance Due
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-ink dark:text-cream-100">
                  {formatMyr(summary.outstanding_myr)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
