import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FolderOpen,
  ListChecks,
  Plus,
  Upload,
} from "lucide-react";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { BulletRow } from "@/components/dashboard/bullet-row";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { TxRow } from "@/components/dashboard/tx-row";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
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
  loadAdminOverview,
  renewalsKpiCopy,
  taskDueLabel,
  taskDueTone,
} from "@/lib/admin/overview";
import { hasAdminAssistantAddon } from "@/lib/marketplace/entitlements";
import { canSurface } from "@/lib/permissions";
import { loadBusiness } from "@/lib/settings/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function AdminPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const business = await loadBusiness(user.businessId);
  if (!business) redirect("/home");

  const canStorage = canSurface(user.role, "admin", "storage");
  const canTasks = canSurface(user.role, "admin", "tasks");
  const canCompliance = canSurface(user.role, "admin", "compliance");
  const hasAdminAssistant = await hasAdminAssistantAddon(user.businessId);

  const data = await loadAdminOverview(supabase, user.businessId, {
    canStorage,
    canTasks,
    canCompliance,
    tier: business.tier,
    hasAdminAssistant,
  });

  const renewalsKpi = renewalsKpiCopy(
    data.complianceOverdue,
    data.complianceDueSoon,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        description="Daily back-office — tasks, licence renewals, and document storage."
        action={
          canStorage ? (
            <Link
              href="/admin/storage"
              className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              <Upload className="h-4 w-4" strokeWidth={2} />
              Upload document
            </Link>
          ) : undefined
        }
      />

      {(canTasks || canCompliance || canStorage) && (
        <section
          aria-label="Quick actions"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {canTasks ? (
            <Link
              href="/admin/tasks"
              className="flex items-center gap-3 rounded-xl border border-cream-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-800"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <Plus className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  Add task
                </p>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  To do · Doing · Done
                </p>
              </div>
            </Link>
          ) : null}
          {canCompliance ? (
            <Link
              href="/admin/compliance"
              className="flex items-center gap-3 rounded-xl border border-cream-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-800"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <CalendarPlus className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  Add renewal
                </p>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  SSM, DBKL, insurance
                </p>
              </div>
            </Link>
          ) : null}
          {canStorage ? (
            <Link
              href="/admin/storage"
              className="flex items-center gap-3 rounded-xl border border-cream-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-800"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <FolderOpen className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink dark:text-cream-100">
                  Open storage
                </p>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  {data.fileCount} file{data.fileCount === 1 ? "" : "s"} stored
                </p>
              </div>
            </Link>
          ) : null}
        </section>
      )}

      <section
        aria-label="Headline KPIs"
        className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4"
      >
        {canStorage ? (
          <KpiTile
            label="Stored documents"
            value={String(data.fileCount)}
            helper={
              data.storageQuotaGb != null
                ? `${formatBytes(data.totalStorageBytes)} of ${data.storageQuotaGb} GB`
                : `${formatBytes(data.totalStorageBytes)} used`
            }
            icon={FolderOpen}
          />
        ) : null}
        {canTasks ? (
          <KpiTile
            label="Open tasks"
            value={String(data.openTaskCount)}
            helper="not yet done"
            icon={Clock}
          />
        ) : null}
        {canCompliance ? (
          <KpiTile
            label="Renewals due"
            value={renewalsKpi.value}
            delta={renewalsKpi.delta}
            deltaTone={renewalsKpi.deltaTone}
            helper="within 30 days or overdue"
            icon={AlertTriangle}
          />
        ) : null}
      </section>

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

      {data.checklist.length > 0 ? (
        <SectionCard
          title="This week"
          subtitle="Suggested actions from your current admin data"
          bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
        >
          {data.checklist.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 py-3 transition-colors hover:bg-cream-50 dark:hover:bg-hairline-dark/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <ListChecks className="h-4 w-4" strokeWidth={2} />
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium text-ink dark:text-cream-100">
                {item.label}
              </p>
            </Link>
          ))}
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {canTasks ? (
          <SectionCard
            title="Open tasks"
            subtitle="Overdue and due-this-week tasks are highlighted"
            bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
            action={
              <Link
                href="/admin/tasks"
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                View all
              </Link>
            }
          >
            {data.openTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted dark:text-cream-400">
                No open tasks —{" "}
                <Link href="/admin/tasks" className="text-brand-600 underline">
                  add one
                </Link>
              </p>
            ) : (
              data.openTasks.map((task) => {
                const dueLabel = taskDueLabel(task.due_date);
                const tone = taskDueTone(task.due_date);
                return (
                  <TxRow
                    key={task.id}
                    icon={Clock}
                    tone={tone}
                    title={task.title}
                    subtitle={
                      [
                        dueLabel,
                        task.due_date ? `Due ${task.due_date}` : null,
                        task.column_label,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    }
                    amount={dueLabel || task.column_label || "Open"}
                  />
                );
              })
            )}
          </SectionCard>
        ) : null}

        {canCompliance ? (
          <SectionCard
            title="Licences & permits"
            subtitle="SSM, DBKL, insurance renewals"
            bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
            action={
              <Link
                href="/admin/compliance"
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                View tracker
              </Link>
            }
          >
            {data.complianceItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted dark:text-cream-400">
                Nothing tracked yet —{" "}
                <Link
                  href="/admin/compliance"
                  className="text-brand-600 underline"
                >
                  add SSM or DBKL
                </Link>
              </p>
            ) : (
              data.complianceItems.map((item) => {
                const urgency = complianceUrgency(item.expires_on);
                const days = daysUntil(item.expires_on);
                return (
                  <TxRow
                    key={item.id}
                    icon={AlertTriangle}
                    tone={
                      urgency === "overdue"
                        ? "danger"
                        : urgency === "soon"
                          ? "warning"
                          : "success"
                    }
                    title={item.title}
                    subtitle={`${complianceCategoryLabel(item.category as AdminComplianceCategory)} · expires ${item.expires_on}`}
                    amount={
                      days < 0
                        ? `${Math.abs(days)}d late`
                        : `${days}d left`
                    }
                  />
                );
              })
            )}
          </SectionCard>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {canStorage ? (
          <SectionCard
            title="Recent uploads"
            subtitle="Latest files in your business storage"
            bodyClassName="divide-y divide-cream-200 dark:divide-hairline-dark"
            action={
              <Link
                href="/admin/storage"
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
              >
                Open storage
              </Link>
            }
          >
            {data.recentFiles.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted dark:text-cream-400">
                No files yet —{" "}
                <Link href="/admin/storage" className="text-brand-600 underline">
                  upload one
                </Link>
              </p>
            ) : (
              data.recentFiles.map((file) => (
                <TxRow
                  key={file.id}
                  icon={FolderOpen}
                  tone="neutral"
                  title={file.file_name}
                  subtitle={fileCategoryLabel(file.category)}
                  amount={fmtRelTime(file.created_at)}
                />
              ))
            )}
          </SectionCard>
        ) : null}

        {canStorage && data.categoryBreakdown.length > 0 ? (
          <SectionCard
            title="Storage by category"
            subtitle="How your documents are tagged"
          >
            <div className="space-y-4">
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
          </SectionCard>
        ) : null}

        {(canTasks || canCompliance) &&
        (data.tasksCompletedThisWeek > 0 ||
          data.renewalsCompletedThisWeek > 0) ? (
          <SectionCard
            title="Completed this week"
            subtitle="Progress since Monday"
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
          </SectionCard>
        ) : null}
      </div>

      {canStorage &&
      data.storageQuotaGb != null &&
      data.storageUsagePct != null ? (
        <SectionCard
          title="Storage usage"
          subtitle={
            data.hasStorageAddon
              ? "Plan quota plus extra storage packs"
              : "Included with your plan"
          }
        >
          <div className="space-y-2">
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
                className={`h-full rounded-full ${
                  data.storageUsagePct >= 90
                    ? "bg-status-danger"
                    : data.storageUsagePct >= 80
                      ? "bg-status-warning"
                      : "bg-brand-500"
                }`}
                style={{ width: `${data.storageUsagePct}%` }}
              />
            </div>
            {data.storageUsagePct >= 80 ? (
              <p className="text-xs text-ink-muted dark:text-cream-400">
                Approaching your limit — add an extra 10 GB pack in{" "}
                <Link href="/marketplace" className="font-semibold underline">
                  Marketplace
                </Link>
                .
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
