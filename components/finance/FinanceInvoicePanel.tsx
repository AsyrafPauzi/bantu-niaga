"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Ban,
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
  documentKind?: "invoice" | "quote" | "all";
  statusFilter?: FinanceInvoiceStatus | "all";
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
  documentKind = "all",
  statusFilter = "all",
}: FinanceInvoicePanelProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => router.refresh(), [router]);

  const patchInvoice = useCallback(
    async (id: string, status: FinanceInvoiceStatus) => {
      if (
        status === "void" &&
        !window.confirm("Void this document? This cannot be undone.")
      ) {
        return;
      }
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

  const convertQuote = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(
          `/api/finance/invoices/${id}/convert-to-invoice`,
          { method: "POST" },
        );
        const json = (await res.json()) as {
          ok: boolean;
          data?: FinanceInvoiceRow;
          error?: { message?: string };
        };
        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error?.message ?? "Conversion failed.");
        }
        router.push(`/finance/invoices/${json.data.id}/edit`);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    },
    [router],
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

  const statusHref = (status: FinanceInvoiceStatus | "all") => {
    const params = new URLSearchParams();
    if (documentKind !== "all") params.set("kind", documentKind);
    if (status !== "all") params.set("status", status);
    const qs = params.toString();
    return qs ? `/finance/invoices?${qs}` : "/finance/invoices";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/finance/invoices/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          New invoice
        </Link>
        <Link
          href="/finance/invoices/new?kind=quote"
          className="inline-flex items-center gap-1.5 rounded-md border border-cream-300 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:text-cream-100"
        >
          <FileText className="h-4 w-4" />
          New quote
        </Link>
        <nav className="ml-auto flex gap-1 rounded-lg bg-cream-100 p-0.5 text-xs font-semibold dark:bg-hairline-dark/40">
          {(
            [
              { key: "all", label: "All", href: "/finance/invoices" },
              {
                key: "invoice",
                label: "Invoices",
                href: "/finance/invoices?kind=invoice",
              },
              {
                key: "quote",
                label: "Quotes",
                href: "/finance/invoices?kind=quote",
              },
            ] as const
          ).map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1",
                documentKind === tab.key
                  ? "bg-white text-ink shadow-card dark:bg-panel-dark dark:text-cream-100"
                  : "text-ink-muted hover:text-ink dark:text-cream-400",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-lg bg-cream-100 p-0.5 text-xs font-semibold dark:bg-hairline-dark/40">
        {(
          [
            { key: "all", label: "All statuses" },
            { key: "draft", label: "Draft" },
            { key: "sent", label: "Sent" },
            { key: "paid", label: "Paid" },
            { key: "void", label: "Void" },
          ] as const
        ).map((tab) => (
          <Link
            key={tab.key}
            href={statusHref(tab.key)}
            className={cn(
              "rounded-md px-3 py-1",
              statusFilter === tab.key
                ? "bg-white text-ink shadow-card dark:bg-panel-dark dark:text-cream-100"
                : "text-ink-muted hover:text-ink dark:text-cream-400",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cream-300 py-10 text-center dark:border-hairline-dark">
          <p className="text-sm text-ink-muted dark:text-cream-400">
            {documentKind === "quote"
              ? "No quotes yet — create a quote and convert it to an invoice when the customer accepts."
              : "No invoices yet — create one with line items and share via WhatsApp or email."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cream-200 rounded-lg border border-cream-200 bg-white dark:divide-hairline-dark dark:border-hairline-dark dark:bg-panel-dark">
          {invoices.map((inv) => {
            const busy = busyId === inv.id;
            const links = shareLinks(inv);
            const total = Number(inv.total_myr);
            const isQuote = inv.document_kind === "quote";
            return (
              <li key={inv.id} className="space-y-3 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink dark:text-cream-100">
                        {inv.number}
                      </p>
                      {isQuote ? (
                        <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent-700 dark:bg-accent-700/20 dark:text-accent-200">
                          Quote
                        </span>
                      ) : null}
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
                  {isQuote ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void convertQuote(inv.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-200"
                    >
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      Convert to invoice
                    </button>
                  ) : null}
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
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchInvoice(inv.id, "void")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted dark:text-cream-400"
                    >
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Ban className="h-3 w-3" />
                      )}
                      Void
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
