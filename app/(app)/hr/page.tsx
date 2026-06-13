import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Plus,
  Users,
} from "lucide-react";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { BulletRow } from "@/components/dashboard/bullet-row";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { ListRow } from "@/components/dashboard/list-row";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TxRow } from "@/components/dashboard/tx-row";

export const metadata = { title: "HR" };

const DEPARTMENTS = [
  { label: "Operations", sublabel: "Warehouse · dispatch", value: "11", fill: 100, tone: "brand" as const },
  { label: "Sales & marketing", sublabel: "POS · customer ops", value: "7", fill: 64, tone: "accent" as const },
  { label: "Finance & admin", sublabel: "Back office", value: "4", fill: 36, tone: "success" as const },
  { label: "Leadership", sublabel: "C-suite", value: "2", fill: 18, tone: "warning" as const },
  { label: "Contractors", sublabel: "Part-time · freelance", value: "0", fill: 0, tone: "muted" as const },
];

const APPROVALS = [
  {
    icon: Calendar,
    tone: "warning" as const,
    title: "Aisyah Rahman — annual leave",
    subtitle: "3 days · pending review",
    amount: "3d",
  },
  {
    icon: FileText,
    tone: "brand" as const,
    title: "Daniel Tan — expense claim",
    subtitle: "Travel · awaiting review",
    amount: "RM 248",
  },
  {
    icon: CheckCircle2,
    tone: "success" as const,
    title: "Nurul Izzah — medical leave",
    subtitle: "1 day · approved",
    amount: "1d",
  },
  {
    icon: Clock,
    tone: "danger" as const,
    title: "Hafiz Ismail — timesheet",
    subtitle: "Overdue · week 24",
    amount: "Wk 24",
  },
];

const UPCOMING = [
  { initials: "AR", title: "Aisyah — annual leave", subtitle: "Mon–Wed · cover by Daniel", value: "3d" },
  { initials: "OB", title: "Onboarding — new hire", subtitle: "Thu 18 Jun · Sales team", value: "D-5" },
  { initials: "RV", title: "Performance review", subtitle: "Fri 19 Jun · Ops mid-year", value: "D-6" },
  { initials: "PR", title: "Payroll cut-off", subtitle: "Sat 28 Jun · lock by 5pm", value: "D-15" },
];

export default function HrPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="HR"
        title="Overview"
        description="Headcount, leave, payroll, and the week ahead."
        action={
          <button className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600">
            <Plus className="h-4 w-4" strokeWidth={2} />
            New employee
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiTile
          label="Headcount"
          value="24"
          delta="+2 this month"
          deltaTone="success"
          helper="3 departments"
          icon={Users}
        />
        <KpiTile
          label="On leave today"
          value="3"
          delta="1 pending"
          deltaTone="warning"
          helper="approval needed"
          icon={Calendar}
        />
        <KpiTile
          label="Payroll this month"
          value="RM 86,400"
          delta="Run 28 Jun"
          deltaTone="brand"
          helper="24 staff"
          icon={DollarSign}
        />
        <KpiTile
          label="Attendance rate"
          value="97%"
          delta="+1%"
          deltaTone="success"
          helper="vs last week"
          icon={CheckCircle2}
        />
      </section>

      <AiBanner
        label="HR Copilot"
        message="Payroll run is due in 15 days. 2 staff have unsubmitted timesheets and 1 leave request needs approval before cut-off."
        cta="Review now"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard
          title="Headcount by department"
          subtitle="24 active employees across 3 teams"
          className="lg:col-span-2"
          bodyClassName="space-y-4"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              View all
            </button>
          }
        >
          {DEPARTMENTS.map((row) => (
            <BulletRow key={row.label} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Pending approvals"
          subtitle="Leave · claims · timesheets"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={<StatusPill tone="warning">4</StatusPill>}
        >
          {APPROVALS.map((row) => (
            <TxRow key={row.title} {...row} />
          ))}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <SectionCard
          title="Upcoming this week"
          subtitle="Leave · onboarding · reviews · payroll"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
          action={
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200">
              Calendar
            </button>
          }
        >
          {UPCOMING.map((row) => (
            <ListRow key={row.title} {...row} />
          ))}
        </SectionCard>

        <SectionCard
          title="Quick actions"
          subtitle="Everyday HR flows"
          bodyClassName="grid gap-2 sm:grid-cols-2"
        >
          {[
            { icon: Users, label: "Add employee", helper: "Register & onboard" },
            { icon: Calendar, label: "Approve leave", helper: "1 pending review" },
            { icon: DollarSign, label: "Run payroll", helper: "Cut-off in 15 days" },
            { icon: FileText, label: "Contract template", helper: "Generate letter" },
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
