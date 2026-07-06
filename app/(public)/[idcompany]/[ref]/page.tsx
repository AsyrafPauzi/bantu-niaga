import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PayFieldCopy } from "@/components/finance/PayFieldCopy";
import { loadPublicFinanceInvoice } from "@/lib/finance/public-invoice";
import { formatMyr } from "@/lib/finance/schemas";

/**
 * Single dispatcher for all unauthenticated secure-hash URLs:
 *   bantuniaga.com/[idcompany]/inv-[hash]    → invoice
 *   bantuniaga.com/[idcompany]/book-[hash]   → customer booking
 *   bantuniaga.com/[idcompany]/leave-[hash]  → self-service leave (HR add-on)
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
  const duitnowId = business.duitnow_id ?? "—";
  const total = formatMyr(Number(invoice.total_myr));
  const isPaid = invoice.status === "paid";

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-medium text-ink-muted dark:text-cream-400">
          Invoice from {business.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink dark:text-cream-100">
          {invoice.number}
        </h1>
        <p className="mt-1 text-sm text-ink-muted dark:text-cream-400">
          Bill to: {invoice.customer_name}
        </p>
        {invoice.title ? (
          <p className="mt-1 text-sm text-ink dark:text-cream-100">{invoice.title}</p>
        ) : null}
      </header>

      {invoice.items.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardBody className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead className="border-b border-cream-200 bg-cream-50 text-left text-xs uppercase text-ink-muted dark:border-hairline-dark dark:bg-panel-dark/60 dark:text-cream-400">
                <tr>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i} className="border-b border-cream-100 dark:border-hairline-dark">
                    <td className="px-4 py-3 text-ink dark:text-cream-100">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-muted dark:text-cream-400">
                      {item.quantity} {item.unit ?? ""}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink dark:text-cream-100">
                      {formatMyr(Number(item.line_total_myr))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Amount due</CardTitle>
            <Badge tone={isPaid ? "success" : "brand"}>
              {isPaid ? "Paid" : invoice.status}
            </Badge>
          </div>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          {invoice.description ? (
            <p className="text-ink-muted dark:text-cream-400">
              {invoice.description}
            </p>
          ) : null}
          <div className="space-y-1 text-xs text-ink-muted dark:text-cream-400">
            <p className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMyr(Number(invoice.amount_myr))}</span>
            </p>
            {Number(invoice.discount_myr) > 0 ? (
              <p className="flex justify-between">
                <span>Discount</span>
                <span>-{formatMyr(Number(invoice.discount_myr))}</span>
              </p>
            ) : null}
            {Number(invoice.tax_myr) > 0 ? (
              <p className="flex justify-between">
                <span>Tax</span>
                <span>{formatMyr(Number(invoice.tax_myr))}</span>
              </p>
            ) : null}
            {Number(invoice.shipping_myr) > 0 ? (
              <p className="flex justify-between">
                <span>Shipping</span>
                <span>{formatMyr(Number(invoice.shipping_myr))}</span>
              </p>
            ) : null}
          </div>
          <p className="text-2xl font-semibold text-ink dark:text-cream-100">
            {total}
          </p>
          {invoice.due_date ? (
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Due: {invoice.due_date}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {!isPaid ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pay Now</CardTitle>
              <Badge tone="brand">DuitNow</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <p className="text-ink-muted dark:text-cream-400">
              Tap to copy each field, paste into your banking app&apos;s DuitNow
              Transfer.
            </p>
            <div className="space-y-2">
              <PayFieldCopy label="DuitNow ID" value={duitnowId} />
              <PayFieldCopy label="Amount (MYR)" value={Number(invoice.total_myr).toFixed(2)} />
              <PayFieldCopy label="Reference" value={invoice.number} />
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="text-sm text-status-success">
            This invoice has been marked as paid. Thank you!
          </CardBody>
        </Card>
      )}
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
