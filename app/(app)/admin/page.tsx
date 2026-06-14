import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Upload,
} from "lucide-react";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { BulletRow } from "@/components/dashboard/bullet-row";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { ListRow } from "@/components/dashboard/list-row";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TxRow } from "@/components/dashboard/tx-row";

export const metadata = { title: "Admin" };

const CATEGORIES = [
  { label: "Operations", sublabel: "SOPs · checklists", value: "42", fill: 100, tone: "success" as const },
  { label: "Contracts", sublabel: "Vendor & client agreements", value: "38", fill: 90, tone: "brand" as const },
  { label: "Finance", sublabel: "Receipts · tax forms", value: "28", fill: 67, tone: "warning" as const },
  { label: "Compliance", sublabel: "SSM · halal · insurance", value: "24", fill: 57, tone: "accent" as const },
  { label: "Insurance", sublabel: "Policies · claims", value: "15", fill: 36, tone: "muted" as const },
];

const TASKS = [
  {
    title: "Renew signboard licence (DBKL)",
    subtitle: "Due in 6 days · Admin team",
    amount: "High",
    tone: "danger" as const,
    icon: AlertTriangle,
  },
  {
    title: "Upload Q2 board minutes",
    subtitle: "Assigned to Daniel · today",
    amount: "Today",
    tone: "warning" as const,
    icon: Clock,
  },
  {
    title: "Re-sign halal cert renewal",
    subtitle: "Compliance · awaiting signature",
    amount: "Sign",
    tone: "brand" as const,
    icon: FileText,
  },
];

const CONTRACTS = [
  {
    initials: "SA",
    title: "Sri Aman Catering — supply MOU",
    subtitle: "Expires 24 Jun · 11 days",
    value: "11d",
  },
  {
    initials: "MC",
    title: "Mega Courier — logistics",
    subtitle: "Expires 02 Jul · 19 days",
    value: "19d",
  },
  {
    initials: "TM",
    title: "TM Unifi — internet",
    subtitle: "Expires 18 Jul · 35 days",
    value: "35d",
  },
];

const VENDORS = [
  { initials: "LH", title: "Lapan Holdings", subtitle: "Logistics · 7 contracts", value: "Active" },
  { initials: "CD", title: "Cyber-1 Distribution", subtitle: "Hardware · 4 contracts", value: "Active" },
  { initials: "BC", title: "Bumi Cafe Supplies", subtitle: "F&B · 6 contracts", value: "Active" },
  { initials: "SA", title: "Sri Aman Catering", subtitle: "Catering · 3 contracts", value: "Review" },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        description="Daily back-office across documents, tasks, compliance, and vendors."
        action={
          <button className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
            <Upload className="h-4 w-4" strokeWidth={2} />
            Upload document
          </button>
        }
      />

      <section
        aria-label="Headline KPIs"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
      >
        <KpiTile
          label="Active documents"
          value="147"
          delta="+12"
          deltaTone="success"
          helper="this month"
          icon={FileText}
        />
        <KpiTile
          label="Pending tasks"
          value="8"
          delta="3 high priority"
          deltaTone="warning"
          helper="across 4 owners"
          icon={Clock}
        />
        <KpiTile
          label="Contracts expiring"
          value="5"
          delta="within 30 days"
          deltaTone="danger"
          helper="needs renewal"
          icon={AlertTriangle}
        />
        <KpiTile
          label="Active vendors"
          value="32"
          delta="+2"
          deltaTone="success"
          helper="this quarter"
          icon={Building2}
        />
      </section>

      <AiBanner
        label="Admin Copilot"
        message="3 vendor contracts expire within the next 30 days. Draft renewal letters from your Templates Library and notify the finance team in one click."
        cta="Draft renewals"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="Documents by category"
          subtitle="147 active documents in the storage vault"
          className="lg:col-span-2"
          bodyClassName="space-y-4"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              View all
            </button>
          }
        >
          {CATEGORIES.map((row) => (
            <BulletRow key={row.label} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Pending tasks"
          subtitle="Smart task matrix"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={<StatusPill tone="warning">3 due</StatusPill>}
        >
          {TASKS.map((task) => (
            <TxRow key={task.title} {...task} />
          ))}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <SectionCard
          title="Contracts expiring soon"
          subtitle="Within 60 days"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              View calendar
            </button>
          }
        >
          {CONTRACTS.map((row) => (
            <ListRow key={row.title} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Recent team activity"
          subtitle="Latest actions across the admin module"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
        >
          <TxRow
            icon={CheckCircle2}
            tone="success"
            title="Aisyah uploaded Halal cert renewal"
            subtitle="Compliance · 12 min ago"
            amount="View"
          />
          <TxRow
            icon={FileText}
            tone="brand"
            title="Daniel created Q2 board minutes"
            subtitle="Documents · 1 hr ago"
            amount="Edit"
          />
          <TxRow
            icon={AlertTriangle}
            tone="warning"
            title="Hafiz flagged signboard licence"
            subtitle="Compliance · 3 hr ago"
            amount="Open"
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Active vendors"
        subtitle="Live supplier relationships"
        bodyClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {VENDORS.map((vendor) => (
          <div
            key={vendor.title}
            className="rounded-lg border border-cream-200 p-3 dark:border-hairline-dark"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold uppercase text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                {vendor.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink dark:text-cream-100">
                  {vendor.title}
                </p>
                <p className="truncate text-xs text-ink-muted dark:text-cream-400">
                  {vendor.subtitle}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex justify-end">
              <StatusPill tone={vendor.value === "Active" ? "success" : "warning"}>
                {vendor.value}
              </StatusPill>
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
