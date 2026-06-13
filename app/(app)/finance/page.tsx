import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { BulletRow } from "@/components/dashboard/bullet-row";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { ListRow } from "@/components/dashboard/list-row";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TxRow } from "@/components/dashboard/tx-row";

export const metadata = { title: "Finance" };

const AR_BUCKETS = [
  { label: "Current", sublabel: "Not yet due", value: "3", fill: 100, tone: "success" as const },
  { label: "1–30 days", sublabel: "Within terms", value: "2", fill: 66, tone: "brand" as const },
  { label: "31–60 days", sublabel: "Late — escalate", value: "1", fill: 33, tone: "warning" as const },
  { label: "61–90 days", sublabel: "Seriously overdue", value: "0", fill: 0, tone: "danger" as const },
  { label: "90+", sublabel: "Write-off candidates", value: "0", fill: 0, tone: "muted" as const },
];

const TRANSACTIONS = [
  {
    icon: ArrowDownRight,
    tone: "success" as const,
    title: "INV-2026-0124 — Lapan Holdings",
    subtitle: "Paid · FPX · 12 min ago",
    amount: "+RM 2,840",
  },
  {
    icon: ArrowUpRight,
    tone: "danger" as const,
    title: "Supplier payout — Sri Aman",
    subtitle: "Outgoing · DuitNow · 1 hr ago",
    amount: "−RM 1,620",
  },
  {
    icon: ArrowDownRight,
    tone: "success" as const,
    title: "INV-2026-0123 — Cyber-1 Distribution",
    subtitle: "Paid · FPX · 3 hr ago",
    amount: "+RM 3,510",
  },
  {
    icon: ArrowUpRight,
    tone: "danger" as const,
    title: "Domain renewal — bantuniaga.com",
    subtitle: "Card · yesterday",
    amount: "−RM 218",
  },
];

const TOP_CUSTOMERS = [
  { initials: "LH", title: "Lapan Holdings", subtitle: "7 invoices · paid on time", value: "RM 18.4K" },
  { initials: "CD", title: "Cyber-1 Distribution", subtitle: "4 invoices · 1 due soon", value: "RM 9,820" },
  { initials: "BC", title: "Bumi Cafe", subtitle: "6 invoices", value: "RM 7,150" },
  { initials: "SA", title: "Sri Aman Catering", subtitle: "3 invoices · 1 overdue", value: "RM 5,340" },
];

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Overview"
        description="Cashflow, receivables, and ledger health at a glance."
        action={
          <button className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
            <Plus className="h-4 w-4" strokeWidth={2} />
            New invoice
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiTile
          label="Revenue (MTD)"
          value="RM 48,210"
          delta="+18%"
          deltaTone="success"
          helper="vs last month"
          icon={TrendingUp}
        />
        <KpiTile
          label="Outstanding AR"
          value="RM 12,840"
          delta="6 invoices"
          deltaTone="warning"
          helper="awaiting payment"
          icon={Clock}
        />
        <KpiTile
          label="Cash on hand"
          value="RM 84,500"
          delta="+RM 6.2K"
          deltaTone="success"
          helper="this week"
          icon={Wallet}
        />
        <KpiTile
          label="Expenses (MTD)"
          value="RM 22,140"
          delta="+9%"
          deltaTone="danger"
          helper="vs last month"
          icon={CreditCard}
        />
      </section>

      <AiBanner
        label="Fayza · Finance AI"
        message="3 overdue invoices totalling RM 4,820 from Sri Aman Catering and Hijau Hortikultur. Draft reminder emails or schedule auto follow-ups."
        cta="Chase invoices"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="AR aging buckets"
          subtitle="RM 12,840 outstanding across 6 customers"
          className="lg:col-span-2"
          bodyClassName="space-y-4"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              View all
            </button>
          }
        >
          {AR_BUCKETS.map((row) => (
            <BulletRow key={row.label} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Recent transactions"
          subtitle="Last 24 hours"
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
          title="Top customers (MTD)"
          subtitle="By revenue this month"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={<StatusPill tone="success">+22%</StatusPill>}
        >
          {TOP_CUSTOMERS.map((row) => (
            <ListRow key={row.title} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Quick actions"
          subtitle="Most common finance flows"
          bodyClassName="grid gap-2 sm:grid-cols-2"
        >
          {[
            { icon: FileText, label: "New invoice", helper: "Send via secure URL" },
            { icon: DollarSign, label: "Record payment", helper: "FPX · DuitNow · Cash" },
            { icon: AlertTriangle, label: "Late reminders", helper: "WA · email script" },
            { icon: CreditCard, label: "Log expense", helper: "Attach receipt photo" },
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
