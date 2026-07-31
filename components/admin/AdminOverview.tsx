import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CalendarPlus,
  Clock,
  FolderOpen,
  ListChecks,
  Plus,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { AdminCatalogEmpty } from "@/components/admin/AdminCatalogUi";
import {
  AdminOverviewPanel,
  AdminOverviewRow,
} from "@/components/admin/AdminOverviewPanel";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { BulletRow } from "@/components/dashboard/bullet-row";
import {
  ModuleAttentionPills,
  ModuleDashboardHero,
  ModuleDashboardShell,
  ModuleHeroStat,
  ModuleQuickActions,
  type ModuleQuickAction,
} from "@/components/dashboard/module-layout";
import {
  categoryLabel as complianceCategoryLabel,
  complianceUrgency,
  daysUntil,
  type AdminComplianceCategory,
} from "@/lib/admin/task-compliance-schemas";
import {
  buildAdminAiMessage,
  fmtRelTime,
  fileCategoryLabel,
  type AdminOverviewData,
  renewalsKpiCopy,
  taskDueLabel,
} from "@/lib/admin/overview";
import { cn } from "@/lib/utils/cn";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const COMPLIANCE_BADGE: Record<"overdue" | "soon" | "ok", string> = {
  overdue:
    "rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
  soon: "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  ok: "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
};

interface AdminOverviewProps {
  data: AdminOverviewData;
  canStorage: boolean;
  canTasks: boolean;
  canCompliance: boolean;
}

export function AdminOverview({
  data,
  canStorage,
  canTasks,
  canCompliance,
}: AdminOverviewProps) {
  const renewalsKpi = renewalsKpiCopy(
    data.complianceOverdue,
    data.complianceDueSoon,
  );

  const needsAttention =
    data.complianceOverdue > 0 ||
    data.complianceDueSoon > 0 ||
    (data.storageUsagePct != null && data.storageUsagePct >= 80);

  const hasActivity =
    data.openTaskCount > 0 ||
    data.fileCount > 0 ||
    data.complianceItems.length > 0;

  const heroHeadline = data.complianceOverdue > 0
    ? `${data.complianceOverdue} renewal${data.complianceOverdue === 1 ? "" : "s"} overdue`
    : data.openTaskCount > 0
      ? `${data.openTaskCount} open task${data.openTaskCount === 1 ? "" : "s"} on the board`
      : data.complianceDueSoon > 0
        ? `${data.complianceDueSoon} renewal${data.complianceDueSoon === 1 ? "" : "s"} due soon`
        : hasActivity
          ? "Back office is in good shape"
          : "Set up your admin workspace";

  const heroSub = data.complianceOverdue > 0
    ? "Licences or permits are past due — update compliance before an inspection."
    : data.complianceDueSoon > 0
      ? "Renewals are coming up in the next 30 days — Amir can help you prep."
      : data.storageUsagePct != null && data.storageUsagePct >= 80
        ? "Storage is getting full — archive old files or add capacity in Marketplace."
        : hasActivity
          ? "Tasks, renewals, and documents are tracked — keep the weekly rhythm going."
          : "Add a task, log a renewal, or upload your first document to get started.";

  const attentionItems = [
    data.complianceOverdue > 0
      ? {
          label: `${data.complianceOverdue} overdue renewal${data.complianceOverdue === 1 ? "" : "s"}`,
          href: "/admin/compliance",
          tone: "danger" as const,
        }
      : null,
    data.complianceDueSoon > 0
      ? {
          label: `${data.complianceDueSoon} due within 30 days`,
          href: "/admin/compliance",
          tone: "warning" as const,
        }
      : null,
    data.storageUsagePct != null && data.storageUsagePct >= 80
      ? {
          label: `Storage ${data.storageUsagePct}% full`,
          href: "/admin/storage",
          tone: "warning" as const,
        }
      : null,
    data.openTaskCount > 0
      ? {
          label: `${data.openTaskCount} open task${data.openTaskCount === 1 ? "" : "s"}`,
          href: "/admin/tasks",
          tone: "neutral" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    href: string;
    tone: "danger" | "warning" | "neutral";
  }>;

  const quickActions: ModuleQuickAction[] = [
    canTasks
      ? {
          href: "/admin/tasks",
          icon: ListChecks,
          title: "Tasks",
          subtitle: "To do · Doing · Done",
          accent: "from-violet-500 to-purple-600",
        }
      : null,
    canCompliance
      ? {
          href: "/admin/compliance",
          icon: ShieldCheck,
          title: "Compliance",
          subtitle: "Licences & renewals",
          accent: "from-amber-500 to-orange-500",
        }
      : null,
    canStorage
      ? {
          href: "/admin/storage",
          icon: FolderOpen,
          title: "Storage",
          subtitle: "Document vault",
          accent: "from-sky-500 to-blue-600",
        }
      : null,
    {
      href: data.hasAdminAssistant ? "/admin/assistant" : "/marketplace",
      icon: Bot,
      title: "Amir AI",
      subtitle: data.hasAdminAssistant ? "Admin copilot" : "View in Marketplace",
      accent: "from-indigo-500 to-fuchsia-600",
    },
  ].filter(Boolean) as ModuleQuickAction[];

  const primaryCta = canStorage ? (
    <Link
      href="/admin/storage"
      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
    >
      <Upload className="h-4 w-4" strokeWidth={2} />
      Upload document
    </Link>
  ) : canTasks ? (
    <Link
      href="/admin/tasks"
      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
    >
      <Plus className="h-4 w-4" strokeWidth={2} />
      Add task
    </Link>
  ) : canCompliance ? (
    <Link
      href="/admin/compliance"
      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
    >
      <CalendarPlus className="h-4 w-4" strokeWidth={2} />
      Add renewal
    </Link>
  ) : null;

  return (
    <ModuleDashboardShell>
      <ModuleDashboardHero
        module="Admin"
        headline={heroHeadline}
        subcopy={heroSub}
        variant={needsAttention ? "attention" : "calm"}
        cta={primaryCta}
      >
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {canStorage ? (
            <ModuleHeroStat
              label="Documents"
              value={data.fileCount}
              hint={
                data.storageQuotaGb != null
                  ? `${formatBytes(data.totalStorageBytes)} of ${data.storageQuotaGb} GB`
                  : `${formatBytes(data.totalStorageBytes)} stored`
              }
              icon={FolderOpen}
              iconClassName="text-sky-700 dark:text-sky-300"
            />
          ) : null}
          {canTasks ? (
            <ModuleHeroStat
              label="Open tasks"
              value={data.openTaskCount}
              hint={`${data.tasksCompletedThisWeek} done this week`}
              icon={Clock}
              iconClassName="text-violet-700 dark:text-violet-300"
            />
          ) : null}
          {canCompliance ? (
            <ModuleHeroStat
              label="Renewals"
              value={renewalsKpi.value}
              hint="within 30 days or overdue"
              icon={AlertTriangle}
              iconClassName="text-amber-700 dark:text-amber-300"
            />
          ) : null}
          {canStorage && data.storageUsagePct != null ? (
            <ModuleHeroStat
              label="Storage used"
              value={`${data.storageUsagePct}%`}
              hint={
                data.storageUsagePct >= 80 ? "Consider extra space" : "Plan quota"
              }
              icon={FolderOpen}
              iconClassName="text-emerald-700 dark:text-emerald-300"
              href="/admin/storage"
            />
          ) : null}
        </div>
      </ModuleDashboardHero>

      {data.checklist.length > 0 ? (
        <section className="rounded-2xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                This week
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Suggested actions from your admin data
              </p>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {data.checklist.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl border border-violet-200/60 bg-white/80 px-3 py-2.5 text-sm transition-colors hover:bg-white dark:border-violet-900/50 dark:bg-panel-dark/80 dark:hover:bg-panel-dark"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                    <ListChecks className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="font-medium text-ink dark:text-cream-100">
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ModuleAttentionPills items={attentionItems} />

      {canStorage &&
      data.storageQuotaGb != null &&
      data.storageUsagePct != null ? (
        <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
                Storage usage
              </h2>
              <p className="text-xs text-ink-muted dark:text-cream-400">
                {data.hasStorageAddon
                  ? "Plan quota plus extra storage packs"
                  : "Included with your plan"}
              </p>
            </div>
            <Link
              href="/admin/storage"
              className="text-xs font-semibold text-brand-700 dark:text-brand-200"
            >
              Open storage
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink-muted dark:text-cream-400">
                {formatBytes(data.totalStorageBytes)} of {data.storageQuotaGb} GB
              </span>
              <span className="font-semibold text-ink dark:text-cream-100">
                {data.storageUsagePct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-cream-200 dark:bg-hairline-dark">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  data.storageUsagePct >= 90
                    ? "bg-status-danger"
                    : data.storageUsagePct >= 80
                      ? "bg-status-warning"
                      : "bg-brand-500",
                )}
                style={{ width: `${data.storageUsagePct}%` }}
              />
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {canTasks ? (
          <AdminOverviewPanel
            title="Open tasks"
            subtitle="Overdue and due-this-week tasks are highlighted"
            action={
              <Link
                href="/admin/tasks"
                className="text-xs font-semibold text-brand-700 dark:text-brand-200"
              >
                View board
              </Link>
            }
          >
            <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {data.openTasks.length === 0 ? (
                <div className="px-4 py-6 sm:px-5">
                  <AdminCatalogEmpty
                    icon={ListChecks}
                    title="No open tasks"
                    hint="Capture admin work on the board so renewals and filings stay on track."
                    className="border-none bg-transparent py-8 dark:bg-transparent"
                    action={
                      <Link
                        href="/admin/tasks"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                      >
                        <Plus className="h-4 w-4" />
                        Add task
                      </Link>
                    }
                  />
                </div>
              ) : (
                data.openTasks.map((task) => {
                  const dueLabel = taskDueLabel(task.due_date);
                  const overdue = dueLabel.includes("overdue");
                  return (
                    <AdminOverviewRow
                      key={task.id}
                      href={`/admin/tasks?task=${task.id}`}
                      title={task.title}
                      subtitle={[
                        dueLabel,
                        task.due_date ? `Due ${task.due_date}` : null,
                        task.column_label,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      overdue={overdue}
                      badge={
                        task.column_label ? (
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
                            {task.column_label}
                          </span>
                        ) : null
                      }
                    />
                  );
                })
              )}
            </div>
          </AdminOverviewPanel>
        ) : null}

        {canCompliance ? (
          <AdminOverviewPanel
            title="Licences & permits"
            subtitle="SSM, DBKL, insurance renewals"
            action={
              <Link
                href="/admin/compliance"
                className="text-xs font-semibold text-brand-700 dark:text-brand-200"
              >
                View tracker
              </Link>
            }
          >
            <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {data.complianceItems.length === 0 ? (
                <div className="px-4 py-6 sm:px-5">
                  <AdminCatalogEmpty
                    icon={ShieldCheck}
                    title="No renewals tracked"
                    hint="Start with SSM or your most critical permit — Amir can coach you later."
                    className="border-none bg-transparent py-8 dark:bg-transparent"
                    action={
                      <Link
                        href="/admin/compliance"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                      >
                        <CalendarPlus className="h-4 w-4" />
                        Add renewal
                      </Link>
                    }
                  />
                </div>
              ) : (
                data.complianceItems.map((item) => {
                  const urgency = complianceUrgency(item.expires_on);
                  const days = daysUntil(item.expires_on);
                  return (
                    <AdminOverviewRow
                      key={item.id}
                      href="/admin/compliance"
                      title={item.title}
                      subtitle={`${complianceCategoryLabel(item.category as AdminComplianceCategory)} · expires ${item.expires_on}`}
                      overdue={urgency === "overdue"}
                      badge={
                        <span className={COMPLIANCE_BADGE[urgency]}>
                          {urgency === "overdue"
                            ? `${Math.abs(days)}d late`
                            : urgency === "soon"
                              ? `${days}d left`
                              : "On track"}
                        </span>
                      }
                    />
                  );
                })
              )}
            </div>
          </AdminOverviewPanel>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {canStorage ? (
          <AdminOverviewPanel
            title="Recent uploads"
            subtitle="Latest files in your business storage"
            action={
              <Link
                href="/admin/storage"
                className="text-xs font-semibold text-brand-700 dark:text-brand-200"
              >
                Open storage
              </Link>
            }
          >
            <div className="divide-y divide-cream-200 dark:divide-hairline-dark">
              {data.recentFiles.length === 0 ? (
                <div className="px-4 py-6 sm:px-5">
                  <AdminCatalogEmpty
                    icon={FolderOpen}
                    title="No files yet"
                    hint="Receipts, contracts, and licence PDFs — private to your team."
                    className="border-none bg-transparent py-8 dark:bg-transparent"
                    action={
                      <Link
                        href="/admin/storage"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                      >
                        <Upload className="h-4 w-4" />
                        Upload document
                      </Link>
                    }
                  />
                </div>
              ) : (
                data.recentFiles.map((file) => (
                  <AdminOverviewRow
                    key={file.id}
                    href="/admin/storage"
                    title={file.file_name}
                    subtitle={fileCategoryLabel(file.category)}
                    trailing={
                      <span className="text-xs tabular-nums text-ink-muted dark:text-cream-400">
                        {fmtRelTime(file.created_at)}
                      </span>
                    }
                  />
                ))
              )}
            </div>
          </AdminOverviewPanel>
        ) : null}

        {canStorage && data.categoryBreakdown.length > 0 ? (
          <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-5">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Storage by category
            </h2>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              How your documents are tagged
            </p>
            <div className="mt-4 space-y-4">
              {data.categoryBreakdown.map((row) => (
                <BulletRow
                  key={row.category}
                  label={row.label}
                  value={String(row.count)}
                  fill={row.fillPct}
                  tone="brand"
                />
              ))}
            </div>
          </section>
        ) : null}

        {(canTasks || canCompliance) &&
        (data.tasksCompletedThisWeek > 0 ||
          data.renewalsCompletedThisWeek > 0) ? (
          <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-card dark:border-hairline-dark dark:bg-panel-dark sm:p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-ink dark:text-cream-100">
              Completed this week
            </h2>
            <p className="text-xs text-ink-muted dark:text-cream-400">
              Progress since Monday
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {canTasks ? (
                <div className="rounded-lg border border-status-success/30 bg-status-success/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-status-success">
                    Tasks done
                  </p>
                  <p className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
                    {data.tasksCompletedThisWeek}
                  </p>
                </div>
              ) : null}
              {canCompliance ? (
                <div className="rounded-lg border border-brand-200 bg-brand-50/80 p-4 dark:border-brand-800 dark:bg-brand-900/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-200">
                    Renewals marked
                  </p>
                  <p className="mt-1 text-2xl font-bold text-ink dark:text-cream-100">
                    {data.renewalsCompletedThisWeek}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      {quickActions.length > 0 ? (
        <ModuleQuickActions module="Admin" actions={quickActions} />
      ) : null}

      {data.hasAdminAssistant ? (
        <AiBanner
          label="Amir · Admin AI"
          message={buildAdminAiMessage(data)}
          cta="Chat with Amir"
          href="/admin/assistant"
        />
      ) : (
        <AiBanner
          label="Amir · Admin AI"
          message="Get weekly admin checklists, renewal reminders, and document organisation tips from your Admin assistant."
          cta="View in Marketplace"
          href="/marketplace"
        />
      )}
    </ModuleDashboardShell>
  );
}
