import {
  BarChart3,
  CornerUpLeft,
  CreditCard,
  DollarSign,
  Plus,
  ShoppingCart,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { BulletRow } from "@/components/dashboard/bullet-row";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { ListRow } from "@/components/dashboard/list-row";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TxRow } from "@/components/dashboard/tx-row";

export const metadata = { title: "Sales" };

const TOP_SKUS = [
  { label: "Beras 5kg — wangi", sublabel: "284 units sold", value: "RM 12.4K", fill: 100, tone: "brand" as const },
  { label: "Minyak masak 5L", sublabel: "196 units sold", value: "RM 8.9K", fill: 72, tone: "accent" as const },
  { label: "Tepung gandum 1kg", sublabel: "412 units sold", value: "RM 6.2K", fill: 50, tone: "success" as const },
  { label: "Gula halus 1kg", sublabel: "308 units sold", value: "RM 4.8K", fill: 39, tone: "warning" as const },
  { label: "Susu pekat 397g", sublabel: "172 units sold", value: "RM 3.1K", fill: 25, tone: "muted" as const },
];

const TRANSACTIONS = [
  {
    icon: CreditCard,
    tone: "success" as const,
    title: "TXN-0091 — walk-in customer",
    subtitle: "Card · 4 min ago",
    amount: "+RM 142",
  },
  {
    icon: Smartphone,
    tone: "brand" as const,
    title: "TXN-0090 — Bumi Cafe",
    subtitle: "DuitNow QR · 22 min ago",
    amount: "+RM 318",
  },
  {
    icon: DollarSign,
    tone: "success" as const,
    title: "TXN-0089 — walk-in customer",
    subtitle: "Cash · 45 min ago",
    amount: "+RM 68",
  },
  {
    icon: CornerUpLeft,
    tone: "neutral" as const,
    title: "RTN-0012 — Lapan Holdings",
    subtitle: "Refund · 2 hr ago",
    amount: "−RM 84",
  },
];

const PAYMENT_MIX = [
  { initials: "QR", title: "DuitNow / QR Pay", subtitle: "312 transactions", value: "48%" },
  { initials: "CD", title: "Card (Visa / MC)", subtitle: "184 transactions", value: "28%" },
  { initials: "$", title: "Cash", subtitle: "108 transactions", value: "17%" },
  { initials: "FX", title: "FPX / Online banking", subtitle: "42 transactions", value: "7%" },
];

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales"
        title="Overview"
        description="Today's counter, MTD trend, top SKUs, and payment mix."
        action={
          <button className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
            <Plus className="h-4 w-4" strokeWidth={2} />
            New sale
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiTile
          label="Sales today"
          value="RM 3,420"
          delta="+12%"
          deltaTone="success"
          helper="vs yesterday"
          icon={ShoppingCart}
        />
        <KpiTile
          label="Transactions today"
          value="48"
          delta="+5"
          deltaTone="success"
          helper="avg ticket RM 71"
          icon={CreditCard}
        />
        <KpiTile
          label="Sales (MTD)"
          value="RM 62,180"
          delta="+22%"
          deltaTone="success"
          helper="vs last month"
          icon={BarChart3}
        />
        <KpiTile
          label="Returns"
          value="3"
          delta="0.4%"
          deltaTone="neutral"
          helper="of sales this month"
          icon={CornerUpLeft}
        />
      </section>

      <AiBanner
        label="Sales Copilot"
        message="Beras 5kg is your top mover this week (+38% units). Stock buffer drops below reorder point in ~6 days at current pace."
        cta="Open POS"
        href="/sales/pos"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="Top SKUs (MTD)"
          subtitle="Ranked by revenue this month"
          className="lg:col-span-2"
          bodyClassName="space-y-4"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              View all
            </button>
          }
        >
          {TOP_SKUS.map((row) => (
            <BulletRow key={row.label} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Recent transactions"
          subtitle="Latest counter activity"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              All
            </button>
          }
        >
          {TRANSACTIONS.map((row) => (
            <TxRow key={row.title} {...row} />
          ))}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <SectionCard
          title="Payment mix (MTD)"
          subtitle="Tender breakdown"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={<StatusPill tone="brand">646 txns</StatusPill>}
        >
          {PAYMENT_MIX.map((row) => (
            <ListRow key={row.title} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Quick actions"
          subtitle="Counter shortcuts"
          bodyClassName="grid gap-2 sm:grid-cols-2"
        >
          {[
            { icon: ShoppingCart, label: "Open POS", helper: "Start a new sale" },
            { icon: TrendingUp, label: "Sales report", helper: "Daily / MTD" },
            { icon: CornerUpLeft, label: "Refund", helper: "Find a transaction" },
            { icon: Smartphone, label: "Send QR", helper: "DuitNow ID share" },
          ].map((action) => (
            <button
              key={action.label}
              className="flex items-start gap-3 rounded-lg border border-cream-200 p-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40 dark:border-hairline-dark dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <action.icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink dark:text-cream-100">
                  {action.label}
                </span>
                <span className="block text-xs text-ink-muted dark:text-cream-400">
                  {action.helper}
                </span>
              </span>
            </button>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
