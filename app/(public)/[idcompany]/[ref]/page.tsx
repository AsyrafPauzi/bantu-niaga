import Image from "next/image";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayFieldCopy } from "@/components/finance/PayFieldCopy";
import { FinancePublicCheckoutButton } from "@/components/finance/FinancePublicCheckoutButton";
import { InvoicePrintButton } from "@/components/finance/InvoicePrintButton";
import { isFinanceBillplzCheckoutEnabled } from "@/lib/finance/billplz-config";
import { loadPublicFinanceInvoice } from "@/lib/finance/public-invoice";
import { loadPublicAdminFile } from "@/lib/admin/public-file";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatStorageBytes } from "@/lib/admin/storage-shared";
import {
  formatFinanceShortDate,
  formatMyr,
  formatQuoteValidUntil,
} from "@/lib/finance/schemas";

/**
 * Single dispatcher for all unauthenticated secure-hash URLs:
 *   bantuniaga.com/[idcompany]/inv-[hash]    → invoice
 *   bantuniaga.com/[idcompany]/book-[hash]   → customer booking
 *   bantuniaga.com/[idcompany]/leave-[hash]  → self-service leave (HR add-on)
 *   bantuniaga.com/[idcompany]/file-[hash]   → shared admin vault file
 *
 * Next.js dynamic segments must occupy the whole folder name, so we use a
 * single `[ref]` segment and parse the prefix to dispatch.
 */

interface Props {
  params: Promise<{ idcompany: string; ref: string }>;
}

const PREFIXES = {
  "inv-": "invoice",
  "book-": "booking",
  "leave-": "leave",
  "file-": "file",
} as const;

type Surface = (typeof PREFIXES)[keyof typeof PREFIXES];

function parseRef(ref: string): { surface: Surface; hash: string } | null {
  for (const [prefix, surface] of Object.entries(PREFIXES) as [
    keyof typeof PREFIXES,
    Surface,
  ][]) {
    if (ref.startsWith(prefix)) {
      const hash = ref.slice(prefix.length);
      if (hash.length < 6) return null;
      return { surface, hash };
    }
  }
  return null;
}

export default async function PublicRefPage({ params }: Props) {
  const { idcompany, ref } = await params;
  const parsed = parseRef(ref);
  if (!parsed) notFound();

  const { surface, hash } = parsed;

  if (surface === "invoice") {
    return <InvoiceView idcompany={idcompany} hash={hash} />;
  }
  if (surface === "booking") return <BookingView idcompany={idcompany} hash={hash} />;
  if (surface === "file") return <FileView idcompany={idcompany} hash={hash} />;
  return <LeaveView idcompany={idcompany} hash={hash} />;
}

// ─── Invoice ───────────────────────────────────────────────────────────────

async function InvoiceView({
  idcompany,
  hash,
}: {
  idcompany: string;
  hash: string;
}) {
  const invoice = await loadPublicFinanceInvoice(idcompany, hash);
  if (!invoice) notFound();

  const { business } = invoice;
  const duitnowId = business.duitnow_id;
  const duitnowQrUrl = business.duitnow_qr_url;
  const total = formatMyr(Number(invoice.total_myr));
  const totalMyr = Number(invoice.total_myr).toFixed(2);
  const isPaid = invoice.status === "paid";
  const isQuote = invoice.document_kind === "quote";
  const fpxEnabled = isFinanceBillplzCheckoutEnabled();
  const showDuitnow =
    !isPaid &&
    !isQuote &&
    invoice.show_duitnow &&
    Boolean(duitnowQrUrl || duitnowId);
  const showPayCard = !isPaid && !isQuote && (fpxEnabled || showDuitnow);
  const quoteBadgeLabel = invoice.status === "sent" ? "Sent" : "Quote";
  const docLabel = isQuote ? "QUOTATION" : "INVOICE";
  const statusTone = isPaid && !isQuote ? "success" : isQuote ? "neutral" : "brand";
  const statusLabel = isQuote ? quoteBadgeLabel : isPaid ? "Paid" : invoice.status === "sent" ? "Sent" : "Draft";

  return (
    <div className="space-y-4">
      {/* ── Toolbar (hidden in print) ── */}
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-ink-muted dark:text-cream-400">
          {docLabel} · {business.name}
        </p>
        <InvoicePrintButton label={`Download ${isQuote ? "Quote" : "Invoice"} PDF`} />
      </div>

      {/* ── Main invoice document ── */}
      <div id="invoice-document" className="rounded-xl border border-cream-200 bg-white shadow-sm overflow-hidden dark:border-hairline-dark dark:bg-panel-dark print:shadow-none print:border-0 print:rounded-none">

        {/* Header: company + doc type */}
        <div className="flex items-start justify-between gap-6 border-b border-cream-200 dark:border-hairline-dark px-8 py-7">
          <div>
            <h1 className="text-xl font-bold text-ink dark:text-cream-100">{business.name}</h1>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">{idcompany}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">{docLabel}</p>
            <p className="mt-1 text-sm font-medium text-ink dark:text-cream-100 tabular-nums">{invoice.number}</p>
            <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isPaid
                ? "bg-status-success/10 text-status-success"
                : isQuote
                ? "bg-cream-200/60 text-ink-muted dark:bg-hairline-dark dark:text-cream-400"
                : "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
            }`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Bill From / Bill To / Invoice Details */}
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 border-b border-cream-200 dark:border-hairline-dark">
          {/* Bill From */}
          <div className="px-8 py-6 sm:border-r border-cream-200 dark:border-hairline-dark">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-500 mb-2">From</p>
            <p className="text-sm font-semibold text-ink dark:text-cream-100">{business.name}</p>
          </div>

          {/* Bill To */}
          <div className="px-8 py-6 sm:border-r border-cream-200 dark:border-hairline-dark border-t sm:border-t-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-500 mb-2">Bill To</p>
            <p className="text-sm font-semibold text-ink dark:text-cream-100">{invoice.customer_name}</p>
            {invoice.customer_email ? (
              <p className="mt-0.5 text-xs text-ink-muted dark:text-cream-400">{invoice.customer_email}</p>
            ) : null}
            {invoice.customer_address?.trim() ? (
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400 whitespace-pre-line leading-relaxed">
                {invoice.customer_address.trim()}
              </p>
            ) : null}
          </div>

          {/* Document meta */}
          <div className="px-8 py-6 border-t sm:border-t-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-500 mb-3">Details</p>
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-4">
                <dt className="text-xs text-ink-muted dark:text-cream-400 shrink-0">{isQuote ? "Quote #" : "Invoice #"}</dt>
                <dd className="text-xs font-medium text-ink dark:text-cream-100 tabular-nums text-right">{invoice.number}</dd>
              </div>
              {invoice.invoice_date ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-xs text-ink-muted dark:text-cream-400 shrink-0">Date</dt>
                  <dd className="text-xs font-medium text-ink dark:text-cream-100 text-right">{formatFinanceShortDate(invoice.invoice_date)}</dd>
                </div>
              ) : null}
              {invoice.due_date ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-xs text-ink-muted dark:text-cream-400 shrink-0">{isQuote ? "Valid Until" : "Due Date"}</dt>
                  <dd className="text-xs font-medium text-ink dark:text-cream-100 text-right">
                    {isQuote ? formatQuoteValidUntil(invoice.due_date) : formatFinanceShortDate(invoice.due_date)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        {/* Title / description */}
        {(invoice.title || invoice.description) ? (
          <div className="px-8 py-4 border-b border-cream-200 dark:border-hairline-dark bg-cream-50/50 dark:bg-panel-dark/30">
            {invoice.title ? (
              <p className="text-sm font-medium text-ink dark:text-cream-100">{invoice.title}</p>
            ) : null}
            {invoice.description ? (
              <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">{invoice.description}</p>
            ) : null}
          </div>
        ) : null}

        {/* Line items table */}
        {invoice.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-50 dark:bg-panel-dark/60 border-b border-cream-200 dark:border-hairline-dark">
                  <th className="px-8 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-500 w-8">#</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-500">Description</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-500 whitespace-nowrap">Qty / Unit</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-500 whitespace-nowrap">Unit Price</th>
                  <th className="px-8 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-cream-100 dark:border-hairline-dark last:border-0 hover:bg-cream-50/40 dark:hover:bg-panel-dark/20 transition-colors"
                  >
                    <td className="px-8 py-3.5 text-xs text-ink-muted dark:text-cream-500 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3.5 text-sm text-ink dark:text-cream-100 max-w-xs">{item.description}</td>
                    <td className="px-4 py-3.5 text-right text-sm tabular-nums text-ink-muted dark:text-cream-400 whitespace-nowrap">
                      {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm tabular-nums text-ink-muted dark:text-cream-400">
                      {formatMyr(Number(item.unit_price))}
                    </td>
                    <td className="px-8 py-3.5 text-right text-sm font-medium tabular-nums text-ink dark:text-cream-100">
                      {formatMyr(Number(item.line_total_myr))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Totals */}
        <div className="flex justify-end border-t border-cream-200 dark:border-hairline-dark px-8 py-6">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted dark:text-cream-400">Subtotal</span>
              <span className="tabular-nums text-ink dark:text-cream-100">{formatMyr(Number(invoice.amount_myr))}</span>
            </div>
            {Number(invoice.discount_myr) > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted dark:text-cream-400">Discount</span>
                <span className="tabular-nums text-status-success">−{formatMyr(Number(invoice.discount_myr))}</span>
              </div>
            ) : null}
            {Number(invoice.tax_myr) > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted dark:text-cream-400">Tax (SST)</span>
                <span className="tabular-nums text-ink dark:text-cream-100">{formatMyr(Number(invoice.tax_myr))}</span>
              </div>
            ) : null}
            {Number(invoice.shipping_myr) > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted dark:text-cream-400">Shipping</span>
                <span className="tabular-nums text-ink dark:text-cream-100">{formatMyr(Number(invoice.shipping_myr))}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-baseline border-t border-cream-200 dark:border-hairline-dark pt-3 mt-3">
              <span className="text-sm font-semibold text-ink dark:text-cream-100">{isQuote ? "Total" : "Amount Due"}</span>
              <span className="text-2xl font-bold tabular-nums text-ink dark:text-cream-100">{total}</span>
            </div>
            {isPaid ? (
              <p className="text-right text-xs font-medium text-status-success">✓ Paid in full</p>
            ) : invoice.due_date && !isQuote ? (
              <p className="text-right text-xs text-ink-muted dark:text-cream-400">
                Due {formatFinanceShortDate(invoice.due_date)}
              </p>
            ) : null}
          </div>
        </div>

        {/* Notes / Terms */}
        {invoice.notes?.trim() ? (
          <div className="border-t border-cream-200 dark:border-hairline-dark px-8 py-5 bg-cream-50/50 dark:bg-panel-dark/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted dark:text-cream-500 mb-2">
              {isQuote ? "Terms & Conditions" : "Notes"}
            </p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-muted dark:text-cream-400">
              {invoice.notes.trim()}
            </p>
          </div>
        ) : null}

        {/* Paid stamp */}
        {isPaid ? (
          <div className="border-t border-cream-200 dark:border-hairline-dark px-8 py-4 bg-status-success/5">
            <p className="text-sm font-semibold text-status-success">
              ✓ This {isQuote ? "quote" : "invoice"} has been paid. Thank you!
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Payment section (hidden in print) ── */}
      {showPayCard ? (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Pay this invoice</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5 text-sm">
            {fpxEnabled ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                  Online — FPX / card
                </p>
                <FinancePublicCheckoutButton
                  idcompany={idcompany}
                  shareHash={hash}
                />
              </div>
            ) : null}

            {fpxEnabled && showDuitnow ? (
              <div className="relative py-1 text-center text-xs text-ink-muted dark:text-cream-400">
                <span className="bg-panel-light px-2 dark:bg-panel-dark">or</span>
                <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-cream-200 dark:border-hairline-dark" />
              </div>
            ) : null}

            {showDuitnow ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                    DuitNow
                  </p>
                  <Badge tone="brand">Scan or transfer</Badge>
                </div>

                {duitnowQrUrl ? (
                  <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50/50 p-4 text-center dark:border-hairline-dark dark:bg-panel-dark/40">
                    <Image
                      src={duitnowQrUrl}
                      alt="DuitNow QR code"
                      width={200}
                      height={200}
                      className="mx-auto rounded-lg"
                      unoptimized
                    />
                    <p className="mt-3 text-sm text-ink dark:text-cream-100">
                      Scan with your banking app to pay{" "}
                      <span className="font-semibold tabular-nums">{total}</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                      Use reference <span className="font-medium">{invoice.number}</span>{" "}
                      if your bank asks for one.
                    </p>
                  </div>
                ) : null}

                {duitnowId ? (
                  <div className="space-y-2">
                    {duitnowQrUrl ? (
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        Prefer manual transfer? Copy these details:
                      </p>
                    ) : (
                      <p className="text-xs text-ink-muted dark:text-cream-400">
                        Copy each field into your banking app&apos;s DuitNow transfer.
                      </p>
                    )}
                    <PayFieldCopy label="DuitNow ID" value={duitnowId} />
                    <PayFieldCopy label="Amount (MYR)" value={totalMyr} />
                    <PayFieldCopy label="Reference" value={invoice.number} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

// ─── Booking ───────────────────────────────────────────────────────────────

function BookingView({
  idcompany,
  hash,
}: {
  idcompany: string;
  hash: string;
}) {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-medium text-ink-muted">Book a slot</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{idcompany}</h1>
        <p className="mt-1 text-xs text-ink-subtle">ref: {hash}</p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Select a service</CardTitle>
            <Badge tone="brand">core</Badge>
          </div>
        </CardHeader>
        <CardBody className="text-sm text-ink-muted">
          <p>
            Customer-facing booking page (scaffold). Picks a Service Type → sees
            available slots (Resources + buffer time) → enters name + phone →
            confirms.
          </p>
        </CardBody>
      </Card>

      <ScaffoldNote>Real booking logic lands in Phase 2.</ScaffoldNote>
    </div>
  );
}

// ─── Self-Service Leave ────────────────────────────────────────────────────

function LeaveView({
  idcompany,
  hash,
}: {
  idcompany: string;
  hash: string;
}) {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-medium text-ink-muted">Leave request</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{idcompany}</h1>
        <p className="mt-1 text-xs text-ink-subtle">ref: {hash}</p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Self-service leave form</CardTitle>
            <Badge tone="accent">add-on</Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-ink-muted">
          <p>
            Staff enter their{" "}
            <span className="font-medium text-ink">Staff ID</span> to unlock the
            form, pick AL / EL / MC, dates, reason, attach an MC photo if
            applicable, and submit.
          </p>
          <p>
            On Approve / Reject, an automated email goes to the staff member's
            registered email.
          </p>
        </CardBody>
      </Card>

      <ScaffoldNote>
        This surface activates only when the{" "}
        <span className="font-medium text-ink">
          Self-Service Mobile Leave Forms
        </span>{" "}
        HR add-on is enabled.
      </ScaffoldNote>
    </div>
  );
}

// ─── Shared admin file ─────────────────────────────────────────────────────

async function FileView({
  idcompany,
  hash,
}: {
  idcompany: string;
  hash: string;
}) {
  const file = await loadPublicAdminFile(idcompany, hash);
  if (!file) notFound();

  const svc = createServiceRoleClient();
  const { data: signed } = await svc.storage
    .from("admin-files")
    .createSignedUrl(file.storage_path, 15 * 60, {
      download: file.file_name,
    });

  const downloadUrl = signed?.signedUrl ?? null;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-medium text-ink-muted">Shared document</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{file.business.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">{file.file_name}</p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="truncate">{file.file_name}</CardTitle>
            <Badge tone="neutral">{formatStorageBytes(file.file_size_bytes)}</Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-4 text-sm text-ink-muted">
          {file.description ? <p>{file.description}</p> : null}
          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Download file
            </a>
          ) : (
            <p>This link is no longer available. Ask the sender for a new link.</p>
          )}
          <p className="text-xs text-ink-subtle">
            Secure link from {file.business.name}. Do not forward unless you trust the recipient.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────────────

function ScaffoldNote({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="text-sm text-ink-muted">
        <p>
          <span className="font-medium text-ink">Status:</span> scaffold —{" "}
          {children}
        </p>
      </CardBody>
    </Card>
  );
}
