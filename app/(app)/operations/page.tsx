import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Package,
  Plus,
  Truck,
} from "lucide-react";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { BulletRow } from "@/components/dashboard/bullet-row";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { ListRow } from "@/components/dashboard/list-row";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TxRow } from "@/components/dashboard/tx-row";

export const metadata = { title: "Operations" };

const PIPELINE = [
  { label: "New", sublabel: "Awaiting confirmation", value: "7", fill: 47, tone: "muted" as const },
  { label: "Packing", sublabel: "In warehouse", value: "15", fill: 100, tone: "warning" as const },
  { label: "Dispatch", sublabel: "With courier", value: "8", fill: 53, tone: "brand" as const },
  { label: "In transit", sublabel: "On the way", value: "9", fill: 60, tone: "accent" as const },
  { label: "Delivered", sublabel: "Awaiting POD", value: "3", fill: 20, tone: "success" as const },
];

const RECENT_ORDERS = [
  {
    icon: Package,
    tone: "warning" as const,
    title: "ORD-2026-0418 — Lapan Holdings",
    subtitle: "Packing · ship by 5pm",
    amount: "RM 1,240",
  },
  {
    icon: Truck,
    tone: "brand" as const,
    title: "ORD-2026-0417 — Cyber-1 Distribution",
    subtitle: "Dispatch · with courier",
    amount: "RM 2,860",
  },
  {
    icon: CheckCircle2,
    tone: "success" as const,
    title: "ORD-2026-0416 — Bumi Cafe",
    subtitle: "Delivered · POD received",
    amount: "RM 640",
  },
  {
    icon: AlertTriangle,
    tone: "danger" as const,
    title: "ORD-2026-0415 — Sri Aman Catering",
    subtitle: "SLA risk · address issue",
    amount: "RM 980",
  },
];

const LOW_STOCK = [
  { initials: "01", title: "Beras 5kg — wangi", subtitle: "4 left · reorder pt 20", value: "Critical" },
  { initials: "02", title: "Gula halus 1kg", subtitle: "9 left · reorder pt 30", value: "Low" },
  { initials: "03", title: "Minyak masak 5L", subtitle: "12 left · fast mover", value: "Low" },
  { initials: "04", title: "Tepung gandum 1kg", subtitle: "15 left · stable", value: "Watch" },
];

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Overview"
        description="From order taken to delivery confirmed — every step of the pipeline."
        action={
          <button className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
            <Plus className="h-4 w-4" strokeWidth={2} />
            New order
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiTile
          label="Open orders"
          value="42"
          delta="+6 today"
          deltaTone="brand"
          helper="vs yesterday"
          icon={Package}
        />
        <KpiTile
          label="Awaiting dispatch"
          value="8"
          delta="2 SLA risk"
          deltaTone="warning"
          helper="ship before 5pm"
          icon={Truck}
        />
        <KpiTile
          label="Low-stock SKUs"
          value="5"
          delta="2 critical"
          deltaTone="danger"
          helper="reorder needed"
          icon={Box}
        />
        <KpiTile
          label="On-time delivery"
          value="96%"
          delta="+2%"
          deltaTone="success"
          helper="this week"
          icon={CheckCircle2}
        />
      </section>

      <AiBanner
        label="Ops Copilot"
        message="2 orders are at risk of breaching today's 5pm dispatch SLA. Reassign to the morning shift or contact the courier early."
        cta="Reassign now"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="Order pipeline"
          subtitle="42 active orders across the funnel"
          className="lg:col-span-2"
          bodyClassName="space-y-4"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              View board
            </button>
          }
        >
          {PIPELINE.map((row) => (
            <BulletRow key={row.label} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Recent orders"
          subtitle="Latest movement"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              All
            </button>
          }
        >
          {RECENT_ORDERS.map((row) => (
            <TxRow key={row.title} {...row} />
          ))}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <SectionCard
          title="Low-stock SKUs"
          subtitle="Reorder list"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              Reorder
            </button>
          }
        >
          {LOW_STOCK.map((row) => (
            <ListRow key={row.title} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Quick actions"
          subtitle="Operations shortcuts"
          bodyClassName="grid gap-2 sm:grid-cols-2"
        >
          {[
            { icon: Package, label: "New order", helper: "Counter or phone-in" },
            { icon: Truck, label: "Dispatch run", helper: "Generate label · POD" },
            { icon: Box, label: "Adjust stock", helper: "Count · transfer" },
            { icon: AlertTriangle, label: "SLA escalations", helper: "Today's risks" },
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
