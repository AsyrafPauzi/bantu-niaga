import {
  Calculator,
  CalendarClock,
  CreditCard,
  Database,
  HardDrive,
  MessageSquare,
  Pencil,
  Plus,
  Receipt,
  Sparkles,
  Store,
  Truck,
  UserPlus2,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { loadMarketplaceAdmin } from "@/lib/super-admin/load";
import { PageTopbar } from "@/components/super-admin/PageTopbar";
import {
  KpiCard,
  PageBody,
  StatusPill,
  formatMyr,
  formatInt,
} from "@/components/super-admin/primitives";
import { MarketplaceToggle } from "@/components/super-admin/MarketplaceToggle";
import { PILLAR_LABEL, type Pillar } from "@/lib/auth/entitlements";

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
};

function priceLabel(
  cents: number,
  cadence: "monthly" | "yearly" | "one_time" | "included",
): string {
  if (cadence === "included") return "Included";
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

export default async function SuperAdminMarketplace() {
  const addons = await loadMarketplaceAdmin();

  const liveCount = addons.filter((a) => a.status === "live").length;
  const totalSubs = addons.reduce((s, a) => s + a.active_subscriptions, 0);
  const mrr = addons.reduce((s, a) => s + a.mrr_myr, 0);
  const totalAttachPct =
    addons.length > 0
      ? Math.round(
          (totalSubs / Math.max(1, addons.length * 4)) * 1000,
        ) / 10
      : 0;

  const pillarTabs: { key: "all" | Pillar; label: string; count: number }[] = [
    { key: "all", label: "All", count: addons.length },
    ...(["admin", "finance", "operations", "sales", "hr", "marketing"] as Pillar[]).map(
      (p) => ({
        key: p,
        label: PILLAR_LABEL[p],
        count: addons.filter((a) => a.pillar === p).length,
      }),
    ),
  ];

  return (
    <>
      <PageTopbar
        title="Marketplace"
        subtitle={`${liveCount} live · ${addons.length - liveCount} hidden`}
        right={
          <>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-100">
              <Pencil className="h-3.5 w-3.5" />
              Edit categories
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-muted">
              <Plus className="h-3.5 w-3.5" />
              Add new add-on
            </button>
          </>
        }
      />

      <PageBody>
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            label="Active add-ons"
            value={liveCount}
            delta={`${addons.length} catalog total`}
            trend="up"
          />
          <KpiCard
            label="Add-on MRR"
            value={formatMyr(Math.round(mrr))}
            delta="from tenant activations"
            trend="up"
          />
          <KpiCard
            label="Total subscriptions"
            value={formatInt(totalSubs)}
            subtle="across all tenants"
          />
          <KpiCard
            label="Avg attach rate"
            value={`${totalAttachPct}%`}
            subtle="rough tenant coverage"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pillarTabs.map((t, idx) => (
            <button
              key={t.key}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                idx === 0
                  ? "border-ink bg-ink text-white"
                  : "border-cream-300 bg-white text-ink hover:bg-cream-100"
              }`}
            >
              {t.label}
              <span
                className={`rounded-sm px-1 text-[10px] font-bold ${
                  idx === 0
                    ? "bg-white/20 text-white"
                    : "bg-cream-200 text-ink-muted"
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-cream-300 bg-white shadow-card">
          <div className="grid grid-cols-[300px_110px_120px_110px_110px_120px_56px] gap-3 border-b border-cream-300 bg-cream-100 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            <span>Add-on</span>
            <span>Module</span>
            <span>Price</span>
            <span>Active subs</span>
            <span>MRR</span>
            <span>Status</span>
            <span className="text-right">Live</span>
          </div>
          <ul>
            {addons.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-ink-muted">
                Catalog is empty. Click <em>Add new add-on</em> to publish your
                first item.
              </li>
            )}
            {addons.map((a) => {
              const Icon = ICONS[a.icon] ?? Store;
              return (
                <li
                  key={a.id}
                  className="grid grid-cols-[300px_110px_120px_110px_110px_120px_56px] items-center gap-3 border-b border-cream-300 px-5 py-3 last:border-b-0 hover:bg-cream-100/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-100 text-brand-700">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-ink">
                          {a.name}
                        </p>
                        {a.is_featured && (
                          <span className="inline-flex rounded-sm bg-accent-100 px-1 py-0.5 text-[9px] font-bold text-accent-700 uppercase tracking-wide">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-ink-muted">
                        {a.short_desc}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-ink">
                    {PILLAR_LABEL[a.pillar as Pillar] ?? a.pillar}
                  </span>
                  <span className="text-xs text-ink">
                    {priceLabel(a.price_cents, a.cadence)}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {formatInt(a.active_subscriptions)}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {a.mrr_myr > 0 ? formatMyr(Math.round(a.mrr_myr)) : "—"}
                  </span>
                  {statusToPill(a.status)}
                  <div className="flex justify-end">
                    <MarketplaceToggle
                      addonId={a.id}
                      initialStatus={a.status}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </PageBody>
    </>
  );
}
