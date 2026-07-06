import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TxRow } from "@/components/dashboard/tx-row";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  categoryLabel,
  complianceUrgency,
  daysUntil,
  type AdminComplianceCategory,
} from "@/lib/admin/task-compliance-schemas";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const bizId = user.businessId;

  const [
    filesRes,
    tasksRes,
    complianceRes,
    pendingTasksRes,
  ] = await Promise.all([
    canSurface(user.role, "admin", "storage")
      ? supabase
          .from("admin_files")
          .select("id", { count: "exact", head: true })
          .eq("business_id", bizId)
          .is("deleted_at", null)
      : Promise.resolve({ count: 0 }),
    canSurface(user.role, "admin", "tasks")
      ? supabase
          .from("admin_tasks")
          .select("id, title, status, due_date")
          .eq("business_id", bizId)
          .is("deleted_at", null)
          .neq("status", "done")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    canSurface(user.role, "admin", "compliance")
      ? supabase
          .from("admin_compliance_items")
          .select("id, title, category, expires_on")
          .eq("business_id", bizId)
          .is("deleted_at", null)
          .eq("status", "active")
          .order("expires_on", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    canSurface(user.role, "admin", "tasks")
      ? supabase
          .from("admin_tasks")
          .select("id", { count: "exact", head: true })
          .eq("business_id", bizId)
          .is("deleted_at", null)
          .neq("status", "done")
      : Promise.resolve({ count: 0 }),
  ]);

  const fileCount = filesRes.count ?? 0;
  const pendingTaskCount = pendingTasksRes.count ?? 0;
  const openTasks = (tasksRes.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    due_date: string | null;
  }>;
  const complianceItems = (complianceRes.data ?? []) as Array<{
    id: string;
    title: string;
    category: string;
    expires_on: string;
  }>;

  const expiringSoon = complianceItems.filter(
    (c) => complianceUrgency(c.expires_on) !== "ok",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        description="Daily back-office — tasks, licence renewals, and document storage."
        action={
          canSurface(user.role, "admin", "storage") ? (
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

      <section
        aria-label="Headline KPIs"
        className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4"
      >
        {canSurface(user.role, "admin", "storage") ? (
          <KpiTile
            label="Stored documents"
            value={String(fileCount)}
            helper="receipts & contracts"
            icon={FolderOpen}
          />
        ) : null}
        {canSurface(user.role, "admin", "tasks") ? (
          <KpiTile
            label="Open tasks"
            value={String(pendingTaskCount)}
            helper="not yet done"
            icon={Clock}
          />
        ) : null}
        {canSurface(user.role, "admin", "compliance") ? (
          <KpiTile
            label="Renewals due"
            value={String(expiringSoon)}
            deltaTone={expiringSoon > 0 ? "warning" : "success"}
            helper="within 30 days or overdue"
            icon={AlertTriangle}
          />
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {canSurface(user.role, "admin", "tasks") ? (
          <SectionCard
            title="Open tasks"
            subtitle="Tap cards on the tasks page to advance status"
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
            {openTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted dark:text-cream-400">
                No open tasks —{" "}
                <Link href="/admin/tasks" className="text-brand-600 underline">
                  add one
                </Link>
              </p>
            ) : (
              openTasks.map((task) => (
                <TxRow
                  key={task.id}
                  icon={task.status === "doing" ? Clock : CheckCircle2}
                  tone={task.status === "doing" ? "brand" : "neutral"}
                  title={task.title}
                  subtitle={
                    task.due_date
                      ? `Due ${task.due_date} · ${task.status}`
                      : task.status
                  }
                  amount={task.status === "doing" ? "Doing" : "To do"}
                />
              ))
            )}
          </SectionCard>
        ) : null}

        {canSurface(user.role, "admin", "compliance") ? (
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
            {complianceItems.length === 0 ? (
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
              complianceItems.map((item) => {
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
                    subtitle={`${categoryLabel(item.category as AdminComplianceCategory)} · expires ${item.expires_on}`}
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

      {canSurface(user.role, "admin", "storage") ? (
        <SectionCard
          title="Document storage"
          subtitle="Receipts, contracts, and compliance scans"
          action={
            <Link
              href="/admin/storage"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-200"
            >
              Open storage
            </Link>
          }
        >
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <FileText className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-medium text-ink dark:text-cream-100">
                  {fileCount} file{fileCount === 1 ? "" : "s"} stored
                </p>
                <p className="text-xs text-ink-muted dark:text-cream-400">
                  Private to your business · up to 100 MB per file
                </p>
              </div>
            </div>
            <StatusPill tone={fileCount > 0 ? "success" : "neutral"}>
              {fileCount > 0 ? "Active" : "Empty"}
            </StatusPill>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
