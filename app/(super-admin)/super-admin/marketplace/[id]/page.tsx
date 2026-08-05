import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Calculator,
  CalendarClock,
  CreditCard,
  Database,
  Facebook,
  HardDrive,
  Heart,
  Mail,
  MessageSquare,
  Receipt,
  RefreshCw,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  UserPlus2,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { loadMarketplaceAddonDetail } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import { MarketplaceToggle } from "@/components/super-admin/MarketplaceToggle";
import {
  KpiCard,
  PageBody,
  Section,
  StatusPill,
  formatInt,
  formatMyr,
} from "@/components/super-admin/primitives";
import { PILLAR_LABEL, type Pillar } from "@/lib/auth/entitlements";
import { tierBy } from "@/lib/settings/plans";

export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  receipt: Receipt,
  sparkles: Sparkles,
  zap: Zap,
  "hard-drive": HardDrive,
  "user-plus-2": UserPlus2,
  database: Database,
  "calendar-clock": CalendarClock,
  "credit-card": CreditCard,
  "message-square": MessageSquare,
  users: Users,
  truck: Truck,
  calculator: Calculator,
  store: Store,
  facebook: Facebook,
  mail: Mail,
  "refresh-cw": RefreshCw,
  "bar-chart-3": BarChart3,
  heart: Heart,
  "trending-up": TrendingUp,
};

function priceLabel(
  cents: number,
  cadence: "monthly" | "yearly" | "one_time" | "included",
): string {
  if (cadence === "included") return "Included in plan";
  const myr = cents / 100;
  if (cadence === "monthly") return `${formatMyr(myr)} / month`;
  if (cadence === "yearly") return `${formatMyr(myr)} / year`;
  return `${formatMyr(myr)} one-time`;
}

function statusToPill(status: "live" | "draft" | "disabled") {
  switch (status) {
    case "live":
      return <StatusPill tone="success" label="Live" />;
    case "draft":
      return <StatusPill tone="warning" label="Draft" />;
    case "disabled":
      return <StatusPill tone="muted" label="Disabled" />;
  }
}

function formatActivatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SuperAdminMarketplaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const addon = await loadMarketplaceAddonDetail(id);
  if (!addon) notFound();

  const Icon = ICONS[addon.icon] ?? Store;
  const pillarLabel =
    PILLAR_LABEL[addon.pillar as Pillar] ?? addon.pillar;

  return (
    <>
      <PageTopbar
        title={addon.name}
        subtitle={`${pillarLabel} · ${addon.slug}`}
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-1.5">
              <span className="text-[11px] font-semibold text-ink-muted">
                Catalog live
              </span>
              <MarketplaceToggle
                addonId={addon.id}
                initialStatus={addon.status}
              />
            </div>
            <Link
              href="/super-admin/marketplace"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All add-ons
            </Link>
          </div>
        }
      />

      <PageBody>
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {statusToPill(addon.status)}
              {addon.is_featured && (
                <StatusPill tone="info" label="Featured" />
              )}
              {addon.is_coming_soon && (
                <StatusPill tone="warning" label="Coming soon" />
              )}
            </div>
            <p className="mt-2 text-sm text-ink-muted">{addon.short_desc}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="List price"
            value={priceLabel(addon.price_cents, addon.cadence)}
            subtle={addon.cadence}
          />
          <KpiCard
            label="Active subscriptions"
            value={formatInt(addon.active_subscriptions)}
            subtle="tenants with this add-on"
          />
          <KpiCard
            label="MRR"
            value={formatMyr(Math.round(addon.mrr_myr))}
            subtle="from active activations"
          />
          <KpiCard
            label="Module"
            value={pillarLabel}
            subtle={`sort order ${addon.sort_order}`}
          />
        </div>

        <Section title="Feature overview" description="From marketplace catalog">
          <p className="text-sm leading-relaxed text-ink">
            {addon.long_desc?.trim() || addon.short_desc}
          </p>
        </Section>

        {addon.included_in_tier.length > 0 ? (
          <Section
            title="Included in plans"
            description="Tenants on these tiers get this add-on without extra charge"
          >
            <ul className="flex flex-wrap gap-2">
              {addon.included_in_tier.map((tier) => (
                <li
                  key={tier}
                  className="rounded-md border border-cream-300 bg-cream-50 px-2.5 py-1 text-xs font-semibold text-ink"
                >
                  {tierBy(tier as Parameters<typeof tierBy>[0])?.label ?? tier}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section
          title="Recent activations"
          description={
            addon.recent_activations.length > 0
              ? "Latest tenants that activated this add-on"
              : "No tenant activations yet"
          }
        >
          {addon.recent_activations.length === 0 ? (
            <p className="text-sm text-ink-muted">
              When tenants activate this add-on from Settings → Marketplace, they
              will appear here.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto border-t border-cream-200">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-cream-300 bg-cream-50/80 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2">Tenant</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2">Activated</th>
                  </tr>
                </thead>
                <tbody>
                  {addon.recent_activations.map((row) => (
                    <tr
                      key={`${row.business_id}-${row.activated_at}`}
                      className="border-b border-cream-200 last:border-b-0 hover:bg-cream-50/60"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/super-admin/businesses/${row.business_id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {row.business_name}
                        </Link>
                        <p className="text-[11px] text-ink-muted">
                          {row.idcompany}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill
                          tone={
                            row.status === "active"
                              ? "success"
                              : row.status === "pending_cancel"
                                ? "warning"
                                : "muted"
                          }
                          label={row.status.replace("_", " ")}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {row.qty}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-muted">
                        {formatActivatedAt(row.activated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </PageBody>
    </>
  );
}
