import Link from "next/link";
import { MessageSquareQuote, Plus } from "lucide-react";

interface FinanceNewInvoiceButtonsProps {
  customerIdFilter?: string;
}

export function FinanceNewInvoiceButtons({
  customerIdFilter,
}: FinanceNewInvoiceButtonsProps) {
  const newInvoiceHref = customerIdFilter
    ? `/finance/invoices/new?customer_id=${encodeURIComponent(customerIdFilter)}`
    : "/finance/invoices/new";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={newInvoiceHref}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-brand-600 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        New invoice
      </Link>
      <Link
        href="/finance/invoices/new?kind=quote"
        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-800 shadow-sm transition-transform hover:bg-violet-50 active:scale-[0.98] dark:border-violet-800 dark:bg-panel-dark dark:text-violet-100"
      >
        <MessageSquareQuote className="h-4 w-4" />
        New quote
      </Link>
    </div>
  );
}
