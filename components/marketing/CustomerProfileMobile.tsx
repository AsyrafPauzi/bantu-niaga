import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerForm } from "@/components/marketing/CustomerForm";
import { TagBadge } from "@/components/marketing/TagBadge";
import { cn } from "@/lib/utils/cn";
import type { CustomerFullRow } from "./types";

/**
 * Mobile customer profile.
 *
 * Per the decisions doc Q10, mobile shows the full read-only summary
 * (name, contact, KPIs, tags) but the edit form is restricted to the
 * three fields a solo owner actually edits on the road: notes,
 * manual_tags, phone.
 */

interface CustomerProfileMobileProps {
  customer: CustomerFullRow;
  className?: string;
}

function fmtMyr(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `RM ${n.toFixed(2)}`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function CustomerProfileMobile({
  customer,
  className,
}: CustomerProfileMobileProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardHeader>
          <CardTitle>{customer.name}</CardTitle>
          <div className="mt-2 flex flex-wrap gap-1">
            {(customer.auto_tags ?? []).map((t) => (
              <TagBadge key={`m-h-a-${t}`} label={t} kind="auto" />
            ))}
            {(customer.manual_tags ?? []).map((t) => (
              <TagBadge key={`m-h-m-${t}`} label={t} kind="manual" />
            ))}
          </div>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-ink dark:text-cream-100">
          <Row label="Phone" value={customer.phone_e164 ?? "—"} />
          <Row label="Email" value={customer.email ?? "—"} />
          <Row label="Address" value={customer.address ?? "—"} />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Stat label="Total spend" value={fmtMyr(customer.total_spend_myr)} />
            <Stat label="Orders" value={String(customer.order_count)} />
            <Stat label="AOV" value={fmtMyr(customer.aov_myr)} />
            <Stat label="Last purchase" value={fmtDate(customer.last_purchase_at)} />
          </div>
        </CardBody>
      </Card>

      <CustomerForm
        mode="edit-restricted"
        initial={{
          id: customer.id,
          name: customer.name,
          phone_e164: customer.phone_e164,
          email: customer.email ?? null,
          address: customer.address ?? null,
          manual_tags: customer.manual_tags ?? [],
          notes: customer.notes ?? null,
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs uppercase tracking-wider text-ink-muted dark:text-cream-400">
        {label}
      </span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-cream-100 px-3 py-2 dark:bg-panel-dark/40">
      <p className="text-xs uppercase tracking-wider text-ink-muted dark:text-cream-400">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums text-ink dark:text-cream-100">
        {value}
      </p>
    </div>
  );
}
