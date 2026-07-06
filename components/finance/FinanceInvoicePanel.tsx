"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  buildInvoiceShareMessage,
  emailShareUrl,
  formatMyr,
  invoiceShareUrl,
  whatsAppShareUrl,
  type FinanceInvoiceRow,
  type FinanceInvoiceStatus,
} from "@/lib/finance/schemas";

interface FinanceInvoicePanelProps {
  initialInvoices: FinanceInvoiceRow[];
  idcompany: string;
  businessName: string;
  appUrl: string;
}

const STATUS_LABEL: Record<FinanceInvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
};

export function FinanceInvoicePanel({
  initialInvoices,
  idcompany,
  businessName,
  appUrl,
}: FinanceInvoicePanelProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  const patchInvoice = useCallback(
    async (id: string, status: FinanceInvoiceStatus) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/finance/invoices/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          data?: FinanceInvoiceRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Update failed.");
        }
        setInvoices((prev) =>
          prev.map((i) => (i.id === id ? json.data! : i)),
        );
        refresh();
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const shareLinks = useCallback(
    (inv: FinanceInvoiceRow) => {
      const url = invoiceShareUrl(appUrl, idcompany, inv.share_hash);
      const message = buildInvoiceShareMessage(
        businessName,
        inv.number,
        Number(inv.total_myr),
        url,
      );
      return {
        url,
        whatsapp: whatsAppShareUrl(message),
        email: emailShareUrl(
          `Invoice ${inv.number} from ${businessName}`,
          message,
          inv.customer_email ?? undefined,
        ),
      };
    },
    [appUrl, businessName, idcompany],
  );

  return (
    <div className="space-y-4">
      <Link
        href="/finance/invoices/new"
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
      >
        <Plus className="h-4 w-4" />
        New invoice
      </Link>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cream-300 py-10 text-center dark:border-hairline-dark">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            No invoices yet — create one with line items and share via WhatsApp
            or email.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200 bg-white dark:divide-hairline-dark dark:border-hairline-dark dark:bg-panel-dark">
          {invoices.map((inv) => {
            const busy = busyId === inv.id;
            const links = shareLinks(inv);
            const total = Number(inv.total_myr);
            return (
              <li key={inv.id} className="space-y-3 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink dark:text-cream-100">
                        {inv.number}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          inv.status === "paid" &&
                            "bg-status-success/15 text-status-success",
                          inv.status === "sent" &&
                            "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200",
                          inv.status === "draft" &&
                            "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
                          inv.status === "void" && "bg-cream-200 text-ink-muted",
                        )}
                      >
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </div>
                    <p className="text-sm text-ink dark:text-cream-100">
                      {inv.customer_name}
                    </p>
                    {inv.title ? (
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        {inv.title}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-lg font-semibold tabular-nums text-ink dark:text-cream-100">
                    {formatMyr(total)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-cream-100 pt-3 dark:border-hairline-dark">
                  <Link
                    href={`/finance/invoices/${inv.id}/edit`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted dark:text-cream-400"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Link>
                  {inv.status === "draft" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchInvoice(inv.id, "sent")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-200"
                    >
                      <Send className="h-3 w-3" />
                      Mark sent
                    </button>
                  ) : null}
                  {inv.status === "sent" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchInvoice(inv.id, "paid")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-status-success"
                    >
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Mark paid
                    </button>
                  ) : null}
                  {inv.status !== "void" && inv.status !== "paid" ? (
                    <>
                      <a
                        href={links.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-200"
                      >
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </a>
                      <a
                        href={links.email}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-200"
                      >
                        <Mail className="h-3 w-3" />
                        Email
                      </a>
                    </>
                  ) : null}
                  <a
                    href={links.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-ink-muted underline dark:text-cream-400"
                  >
                    View link
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
