import Link from "next/link";
import {
  ChevronRight,
  Edit3,
  MessageCircle,
  Phone,
  Receipt,
  ShoppingBag,
  Tag,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { CustomerForm } from "@/components/marketing/CustomerForm";
import { CustomerMayaWinBackCard } from "@/components/marketing/CustomerMayaWinBackCard";
import { CustomerRemoveAction } from "@/components/marketing/CustomerRemoveAction";
import { TagBadge } from "@/components/marketing/TagBadge";
import type { CustomerFullRow } from "@/components/marketing/types";
import {
  ModuleDashboardHero,
  ModuleHeroStat,
} from "@/components/dashboard/module-layout";
import {
  CUSTOMER_SOURCE_LABEL,
  customerInitials,
  fmtCustomerDate,
  fmtCustomerRel,
} from "@/lib/marketing/customer-detail-format";
import { customerDetailSubpageHero } from "@/lib/marketing/subpage-hero";
import { formatCount, formatMyr } from "@/lib/marketing/metrics";

export type CustomerActivityTab = "activity" | "orders";

interface EventRow {
  id: string;
  name: string;
  payload: Record<string, unknown>;
  emitted_at: string;
}

interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number | string;
  line_total_myr: number | string;
}

interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  total_myr: number | string;
  invoice_date: string | null;
  created_at: string;
  title: string | null;
  items: InvoiceItemRow[];
}

interface PosSaleItemRow {
  id: string;
  sale_id: string;
  product_name: string;
  quantity: number | string;
  line_total_myr: number | string;
}

interface PosSaleRow {
  id: string;
  sale_number: string;
  total_myr: number | string;
  payment_method: string;
  created_at: string;
  items: PosSaleItemRow[];
}

interface CustomerDetailDesktopViewProps {
  customer: CustomerFullRow;
  activeTab: CustomerActivityTab;
  events: EventRow[];
  invoices: InvoiceRow[];
  posSales: PosSaleRow[];
  mayaInsight: string;
}

const TONE_BG: Record<string, string> = {
  brand: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  success: "bg-status-success/10 text-status-success",
  warning: "bg-status-warning/15 text-[#8C5C0A] dark:text-[#F5C97A]",
  neutral:
    "bg-cream-200 text-ink-muted dark:bg-hairline-dark dark:text-cream-400",
};

function eventLabel(ev: EventRow): {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone: "brand" | "success" | "warning" | "neutral";
} {
  switch (ev.name) {
    case "customer.created":
      return {
        icon: UserPlus,
        title: "Customer created",
        subtitle:
          typeof ev.payload.source === "string"
            ? `Source: ${CUSTOMER_SOURCE_LABEL[ev.payload.source] ?? ev.payload.source}`
            : "Manual entry",
        tone: "brand",
      };
    case "customer.updated":
      return {
        icon: Edit3,
        title: "Profile updated",
        subtitle: "Details edited",
        tone: "neutral",
      };
    case "customer.merged":
      return {
        icon: UserCheck,
        title: "Customer merged",
        subtitle: "Duplicate resolved",
        tone: "brand",
      };
    case "customer.tag_changed": {
      const added = Array.isArray(ev.payload.added_tags)
        ? (ev.payload.added_tags as string[])
        : [];
      const removed = Array.isArray(ev.payload.removed_tags)
        ? (ev.payload.removed_tags as string[])
        : [];
      const parts: string[] = [];
      if (added.length > 0) parts.push(`+${added.join(", ")}`);
      if (removed.length > 0) parts.push(`−${removed.join(", ")}`);
      return {
        icon: Tag,
        title: "Tags updated",
        subtitle: parts.join(" · ") || "Auto-tag recompute",
        tone: "neutral",
      };
    }
    default:
      return {
        icon: ShoppingBag,
        title: ev.name,
        subtitle: "Event",
        tone: "neutral",
      };
  }
}

export function CustomerDetailDesktopView({
  customer: c,
  activeTab,
  events,
  invoices,
  posSales,
  mayaInsight,
}: CustomerDetailDesktopViewProps) {
  const totalSpend =
    typeof c.total_spend_myr === "number"
      ? c.total_spend_myr
      : Number(c.total_spend_myr) || 0;
  const aov =
    c.aov_myr != null
      ? typeof c.aov_myr === "number"
        ? c.aov_myr
        : Number(c.aov_myr) || 0
      : c.order_count > 0
        ? totalSpend / c.order_count
        : 0;

  const hero = customerDetailSubpageHero({
    name: c.name,
    autoTags: c.auto_tags ?? [],
    totalSpendMyr: totalSpend,
    orderCount: c.order_count,
    lastPurchaseAt: c.last_purchase_at,
  });

  const tabHref = (t: CustomerActivityTab) =>
    `/marketing/customers/${c.id}${t === "activity" ? "" : `?tab=${t}`}`;

  const phoneDigits = c.phone_e164?.replace(/[^\d]/g, "") ?? "";

  return (
    <div className="space-y-6 pb-8">
      <ModuleDashboardHero
        module="Marketing · Customers"
        headline={hero.headline}
        subcopy={hero.subcopy}
        variant={hero.variant}
        headerExtra={
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-lg font-bold uppercase text-white shadow-sm">
              {customerInitials(c.name)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(c.auto_tags ?? []).map((t) => (
                <TagBadge key={`h-a-${t}`} label={t} kind="auto" />
              ))}
              {(c.manual_tags ?? []).map((t) => (
                <TagBadge key={`h-m-${t}`} label={t} kind="manual" />
              ))}
            </div>
          </div>
        }
        cta={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/sales/pos?customer_id=${c.id}&customer_name=${encodeURIComponent(c.name)}`}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
            >
              <ShoppingBag className="h-4 w-4" strokeWidth={2} />
              Ring up at POS
            </Link>
            {c.phone_e164 ? (
              <>
              <a
                href={`https://wa.me/${phoneDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2} />
                WhatsApp
              </a>
              <a
                href={`tel:${c.phone_e164}`}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-white dark:border-violet-900/50 dark:bg-panel-dark/80 dark:text-cream-100"
              >
                <Phone className="h-4 w-4" strokeWidth={2} />
                Call
              </a>
              </>
            ) : null}
          </div>
        }
      >
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Lifetime spend"
            value={formatMyr(totalSpend)}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Orders"
            value={formatCount(c.order_count)}
            iconClassName="text-sky-700 dark:text-sky-300"
          />
          <ModuleHeroStat
            label="AOV"
            value={formatMyr(aov)}
            hint="avg order"
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
          <ModuleHeroStat
            label="Last purchase"
            value={c.last_purchase_at ? fmtCustomerRel(c.last_purchase_at) : "—"}
            hint={
              c.last_purchase_at ? fmtCustomerDate(c.last_purchase_at) : "none yet"
            }
            iconClassName="text-amber-700 dark:text-amber-300"
          />
        </div>
      </ModuleDashboardHero>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <section className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-200 px-4 py-3 dark:border-hairline-dark sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                  {activeTab === "orders" ? "Purchase history" : "Timeline"}
                </h2>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  {activeTab === "orders"
                    ? "POS sales and Finance invoices linked to this profile"
                    : "CRM events for this customer"}
                </p>
              </div>
              <nav className="flex gap-1 rounded-lg bg-cream-100 p-0.5 text-[11px] font-semibold dark:bg-hairline-dark/40">
                {(["activity", "orders"] as const).map((t) => (
                  <Link
                    key={t}
                    href={tabHref(t)}
                    className={`rounded-md px-3 py-1 capitalize ${
                      activeTab === t
                        ? "bg-white text-ink shadow-card dark:bg-panel-dark dark:text-cream-100"
                        : "text-ink-muted hover:text-ink dark:text-cream-400"
                    }`}
                  >
                    {t}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="px-4 py-2 sm:px-5">
              {activeTab === "activity" ? (
                events.length > 0 ? (
                  <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
                    {events.map((ev) => {
                      const meta = eventLabel(ev);
                      return (
                        <div key={ev.id} className="flex items-center gap-3 py-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[meta.tone]}`}
                          >
                            <meta.icon className="h-4 w-4" strokeWidth={2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                              {meta.title}
                            </p>
                            <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                              {meta.subtitle}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-ink-muted dark:text-cream-400">
                            {fmtCustomerRel(ev.emitted_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm font-semibold text-ink dark:text-cream-100">
                      No events yet
                    </p>
                    <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                      Profile edits and tag updates will appear here.
                    </p>
                  </div>
                )
              ) : null}

              {activeTab === "orders" ? (
                invoices.length === 0 && posSales.length === 0 ? (
                  c.order_count > 0 ? (
                    <div className="rounded-xl bg-cream-100/60 p-4 text-sm dark:bg-hairline-dark/30">
                      <p className="font-semibold text-ink dark:text-cream-100">
                        {formatCount(c.order_count)} lifetime orders ·{" "}
                        {formatMyr(totalSpend)}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                        Totals from POS/events — no linked invoice or sale rows
                        for this customer yet.
                      </p>
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <ShoppingBag
                        className="mx-auto mb-2 h-6 w-6 text-ink-muted"
                        strokeWidth={1.5}
                      />
                      <p className="text-sm font-semibold text-ink dark:text-cream-100">
                        No orders yet
                      </p>
                      <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
                        POS sales and Finance invoices linked to this customer
                        show up here.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="space-y-4 py-2">
                    {posSales.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                          POS
                        </p>
                        <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200 dark:divide-hairline-dark dark:border-hairline-dark">
                          {posSales.map((sale) => (
                            <li key={sale.id} className="p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink dark:text-cream-100">
                                    {sale.sale_number}
                                  </p>
                                  <p className="text-xs text-ink-muted dark:text-cream-400">
                                    {fmtCustomerDate(sale.created_at)} ·{" "}
                                    {sale.payment_method.replace(/_/g, " ")}
                                  </p>
                                </div>
                                <span className="shrink-0 text-sm font-semibold tabular-nums">
                                  {formatMyr(Number(sale.total_myr) || 0)}
                                </span>
                              </div>
                              {sale.items.length > 0 ? (
                                <ul className="mt-2 space-y-1 border-t border-cream-100 pt-2 text-xs text-ink-muted dark:border-hairline-dark dark:text-cream-400">
                                  {sale.items.map((item) => (
                                    <li
                                      key={item.id}
                                      className="flex justify-between gap-2"
                                    >
                                      <span className="truncate">
                                        {item.product_name} ×{" "}
                                        {Number(item.quantity)}
                                      </span>
                                      <span className="shrink-0 tabular-nums">
                                        {formatMyr(
                                          Number(item.line_total_myr) || 0,
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {invoices.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-cream-400">
                          Finance
                        </p>
                        <ul className="divide-y divide-cream-200 dark:divide-hairline-dark">
                          {invoices.map((inv) => {
                            const when = inv.invoice_date ?? inv.created_at;
                            return (
                              <li key={inv.id}>
                                <Link
                                  href={`/finance/invoices/${inv.id}/edit`}
                                  className="flex items-center gap-3 py-3 transition-colors hover:bg-cream-50 dark:hover:bg-hairline-dark/40"
                                >
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                    <Receipt className="h-4 w-4" strokeWidth={2} />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                                      {inv.number}
                                      {inv.title ? ` · ${inv.title}` : ""}
                                    </p>
                                    <p className="text-xs text-ink-muted dark:text-cream-400">
                                      {fmtCustomerDate(when)} · {inv.status}
                                    </p>
                                  </div>
                                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                                    {formatMyr(Number(inv.total_myr) || 0)}
                                  </span>
                                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )
              ) : null}
            </div>
          </section>

          <section
            id="edit"
            className="scroll-mt-8 rounded-2xl border border-violet-200/80 bg-white p-5 shadow-card dark:border-violet-900/40 dark:bg-panel-dark"
          >
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Edit profile
            </h2>
            <p className="mt-1 text-xs text-ink-muted dark:text-cream-400">
              Update contact details, manual tags, and notes.
            </p>
            <div className="mt-4">
              <CustomerForm
                mode="edit-full"
                initial={{
                  id: c.id,
                  name: c.name,
                  phone_e164: c.phone_e164,
                  email: c.email ?? null,
                  address: c.address ?? null,
                  manual_tags: c.manual_tags ?? [],
                  notes: c.notes ?? null,
                }}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <CustomerMayaWinBackCard
            customerName={c.name}
            autoTags={c.auto_tags ?? []}
            insight={mayaInsight}
          />

          <div className="rounded-2xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
              Contact
            </p>
            <dl className="mt-3 space-y-2.5 text-sm">
              {[
                ["Phone", c.phone_e164 ?? "—"],
                ["Email", c.email ?? "—"],
                ["Address", c.address ?? "—"],
                [
                  "Source",
                  c.source
                    ? (CUSTOMER_SOURCE_LABEL[c.source] ?? c.source)
                    : "—",
                ],
                ["Joined", c.created_at ? fmtCustomerDate(c.created_at) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3">
                  <dt className="text-ink-muted dark:text-cream-400">{k}</dt>
                  <dd className="break-words text-right font-medium text-ink dark:text-cream-100">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {c.notes?.trim() ? (
            <div className="rounded-2xl border border-cream-200 bg-cream-50/80 p-4 dark:border-hairline-dark dark:bg-hairline-dark/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-cream-400">
                Notes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink dark:text-cream-100">
                {c.notes}
              </p>
            </div>
          ) : null}

          <CustomerRemoveAction customerId={c.id} customerName={c.name} />
        </aside>
      </div>
    </div>
  );
}
