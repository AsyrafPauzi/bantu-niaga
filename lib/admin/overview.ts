import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_FILE_CATEGORIES,
  type AdminFileCategory,
} from "@/lib/admin/schemas";
import { loadTaskColumns } from "@/lib/admin/task-columns";
import {
  complianceUrgency,
  daysUntil,
} from "@/lib/admin/task-compliance-schemas";
import { tierBy } from "@/lib/settings/plans";
import { fmtRelTime } from "@/lib/utils/relative-time";

export { fmtRelTime };

const STORAGE_ADDON_SLUG = "storage-10gb";
const STORAGE_ADDON_GB = 10;

export interface AdminRecentFile {
  id: string;
  file_name: string;
  category: string | null;
  created_at: string;
}

export interface AdminCategoryBreakdown {
  category: AdminFileCategory | "uncategorised";
  label: string;
  count: number;
  fillPct: number;
}

export interface AdminChecklistItem {
  id: string;
  label: string;
  href: string;
}

export interface AdminOverviewData {
  fileCount: number;
  totalStorageBytes: number;
  recentFiles: AdminRecentFile[];
  categoryBreakdown: AdminCategoryBreakdown[];
  storageQuotaGb: number | null;
  storageUsagePct: number | null;
  hasStorageAddon: boolean;
  openTaskCount: number;
  openTasks: Array<{
    id: string;
    title: string;
    due_date: string | null;
    column_label: string | null;
  }>;
  complianceOverdue: number;
  complianceDueSoon: number;
  complianceItems: Array<{
    id: string;
    title: string;
    category: string;
    expires_on: string;
  }>;
  tasksCompletedThisWeek: number;
  renewalsCompletedThisWeek: number;
  checklist: AdminChecklistItem[];
  hasAdminAssistant: boolean;
  notifications: AdminNotificationItem[];
}

export interface AdminNotificationItem {
  id: string;
  message: string;
  event_type: string;
  created_at: string;
}

export function fileCategoryLabel(category: string | null): string {
  if (!category) return "Uncategorised";
  const labels: Record<AdminFileCategory, string> = {
    receipt: "Receipts",
    contract: "Contracts",
    hr_doc: "HR documents",
    compliance: "Licences",
    finance: "Finance",
    operations: "Operations",
    marketing: "Marketing (back-office)",
    other: "Other",
  };
  if ((ADMIN_FILE_CATEGORIES as readonly string[]).includes(category)) {
    return labels[category as AdminFileCategory];
  }
  return category.replace(/_/g, " ");
}

export function startOfWeekIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString();
}

export function taskDueTone(
  dueDate: string | null,
): "danger" | "warning" | "brand" | "neutral" {
  if (!dueDate) return "neutral";
  const d = daysUntil(dueDate);
  if (d < 0) return "danger";
  if (d === 0) return "warning";
  if (d <= 7) return "brand";
  return "neutral";
}

export function taskDueLabel(dueDate: string | null): string {
  if (!dueDate) return "";
  const d = daysUntil(dueDate);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Due today";
  if (d <= 7) return `Due in ${d}d`;
  return "";
}

export function renewalsKpiCopy(overdue: number, dueSoon: number): {
  value: string;
  delta?: string;
  deltaTone: "success" | "warning" | "danger";
} {
  const total = overdue + dueSoon;
  if (total === 0) {
    return { value: "0", deltaTone: "success" };
  }
  const parts: string[] = [];
  if (overdue > 0) {
    parts.push(`${overdue} overdue`);
  }
  if (dueSoon > 0) {
    parts.push(`${dueSoon} due soon`);
  }
  return {
    value: String(total),
    delta: parts.join(" · "),
    deltaTone: overdue > 0 ? "danger" : "warning",
  };
}

export function buildAdminChecklist(input: {
  fileCount: number;
  openTaskCount: number;
  complianceTotal: number;
  complianceOverdue: number;
  complianceDueSoon: number;
  urgentComplianceTitle: string | null;
  dueThisWeekTaskTitle: string | null;
  canStorage: boolean;
  canTasks: boolean;
  canCompliance: boolean;
}): AdminChecklistItem[] {
  const items: AdminChecklistItem[] = [];

  if (input.canCompliance && input.complianceOverdue > 0) {
    items.push({
      id: "renew-overdue",
      label:
        input.complianceOverdue === 1 && input.urgentComplianceTitle
          ? `Renew ${input.urgentComplianceTitle}`
          : `Review ${input.complianceOverdue} overdue renewal${input.complianceOverdue === 1 ? "" : "s"}`,
      href: "/admin/compliance",
    });
  }

  if (input.canTasks && input.dueThisWeekTaskTitle) {
    items.push({
      id: "task-due-week",
      label: `Finish task: ${input.dueThisWeekTaskTitle}`,
      href: "/admin/tasks",
    });
  }

  if (input.canCompliance && input.complianceTotal === 0) {
    items.push({
      id: "add-ssm",
      label: "Add your SSM or DBKL renewal date",
      href: "/admin/compliance",
    });
  }

  if (
    input.canCompliance &&
    input.complianceDueSoon > 0 &&
    input.complianceOverdue === 0
  ) {
    items.push({
      id: "plan-renewal",
      label:
        input.complianceDueSoon === 1 && input.urgentComplianceTitle
          ? `Plan renewal for ${input.urgentComplianceTitle}`
          : `Plan ${input.complianceDueSoon} renewal${input.complianceDueSoon === 1 ? "" : "s"} due this month`,
      href: "/admin/compliance",
    });
  }

  if (input.canStorage && input.fileCount === 0) {
    items.push({
      id: "upload-first",
      label: "Upload your first business document",
      href: "/admin/storage",
    });
  }

  if (input.canTasks && input.openTaskCount === 0) {
    items.push({
      id: "weekly-routine",
      label: "Set a weekly admin checklist",
      href: "/admin/tasks",
    });
  }

  if (input.canStorage && input.fileCount > 0 && input.fileCount < 5) {
    items.push({
      id: "organise-storage",
      label: "Sort uploads into receipts, contracts, and licences",
      href: "/admin/storage",
    });
  }

  return items.slice(0, 5);
}

function computeCategoryBreakdown(
  rows: Array<{ category: string | null }>,
): AdminCategoryBreakdown[] {
  const counts = new Map<AdminFileCategory | "uncategorised", number>();
  for (const row of rows) {
    const key =
      row.category &&
      (ADMIN_FILE_CATEGORIES as readonly string[]).includes(row.category)
        ? (row.category as AdminFileCategory)
        : "uncategorised";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = rows.length;
  if (total === 0) return [];

  const preferred: Array<AdminFileCategory | "uncategorised"> = [
    "receipt",
    "contract",
    "compliance",
    "hr_doc",
    "finance",
    "operations",
    "other",
    "uncategorised",
  ];

  return preferred
    .filter((key) => (counts.get(key) ?? 0) > 0)
    .map((key) => {
      const count = counts.get(key) ?? 0;
      return {
        category: key,
        label: fileCategoryLabel(key === "uncategorised" ? null : key),
        count,
        fillPct: Math.round((count / total) * 100),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function loadAdminOverview(
  supabase: SupabaseClient,
  businessId: string,
  options: {
    canStorage: boolean;
    canTasks: boolean;
    canCompliance: boolean;
    tier: string;
    hasAdminAssistant: boolean;
  },
): Promise<AdminOverviewData> {
  const today = todayIso();
  const in30 = inDaysIso(30);
  const weekStart = startOfWeekIso();

  const [
    fileMetaRes,
    recentFilesRes,
    openTasksRes,
    pendingTasksRes,
    complianceListRes,
    complianceOverdueRes,
    complianceSoonRes,
    complianceTotalRes,
    tasksDoneRes,
    renewalsDoneRes,
    storageAddonRes,
    notificationsRes,
  ] = await Promise.all([
    options.canStorage
      ? supabase
          .from("admin_files")
          .select("category, file_size_bytes")
          .eq("business_id", businessId)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    options.canStorage
      ? supabase
          .from("admin_files")
          .select("id, file_name, category, created_at")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    options.canTasks
      ? supabase
          .from("admin_tasks")
          .select("id, title, column_id, due_date")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .is("completed_at", null)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    options.canTasks
      ? supabase
          .from("admin_tasks")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .is("completed_at", null)
      : Promise.resolve({ count: 0 }),
    options.canCompliance
      ? supabase
          .from("admin_compliance_items")
          .select("id, title, category, expires_on")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .eq("status", "active")
          .order("expires_on", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    options.canCompliance
      ? supabase
          .from("admin_compliance_items")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .eq("status", "active")
          .lt("expires_on", today)
      : Promise.resolve({ count: 0 }),
    options.canCompliance
      ? supabase
          .from("admin_compliance_items")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .eq("status", "active")
          .gte("expires_on", today)
          .lte("expires_on", in30)
      : Promise.resolve({ count: 0 }),
    options.canCompliance
      ? supabase
          .from("admin_compliance_items")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .eq("status", "active")
      : Promise.resolve({ count: 0 }),
    options.canTasks
      ? supabase
          .from("admin_tasks")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .not("completed_at", "is", null)
          .gte("completed_at", weekStart)
      : Promise.resolve({ count: 0 }),
    options.canCompliance
      ? supabase
          .from("admin_compliance_items")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .gte("last_renewed_at", weekStart)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("business_addons")
      .select("id, marketplace_addons!inner(slug)")
      .eq("business_id", businessId)
      .eq("status", "active")
      .eq("marketplace_addons.slug", STORAGE_ADDON_SLUG),
    supabase
      .from("business_notifications")
      .select("id, message, event_type, created_at")
      .eq("business_id", businessId)
      .eq("pillar", "admin")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const fileMeta = (fileMetaRes.data ?? []) as Array<{
    category: string | null;
    file_size_bytes: number | string;
  }>;
  const fileCount = fileMeta.length;
  const totalStorageBytes = fileMeta.reduce(
    (sum, row) => sum + Number(row.file_size_bytes ?? 0),
    0,
  );

  const tier = tierBy(options.tier);
  const baseQuotaMb = tier?.quotas.storageMb ?? 5120;
  const storageAddonCount = storageAddonRes.data?.length ?? 0;
  const hasStorageAddon = storageAddonCount > 0;
  let storageQuotaMb: number | null = null;
  let storageUsagePct: number | null = null;

  if (Number.isFinite(baseQuotaMb)) {
    storageQuotaMb = baseQuotaMb + storageAddonCount * STORAGE_ADDON_GB * 1024;
    const quotaBytes = storageQuotaMb * 1024 * 1024;
    storageUsagePct =
      quotaBytes > 0
        ? Math.min(100, Math.round((totalStorageBytes / quotaBytes) * 100))
        : 0;
  }

  const openTasksRaw = (openTasksRes.data ?? []) as Array<{
    id: string;
    title: string;
    column_id: string;
    due_date: string | null;
  }>;
  const taskColumns = options.canTasks
    ? await loadTaskColumns(supabase, businessId)
    : [];
  const columnLabelMap = new Map(taskColumns.map((c) => [c.id, c.label]));
  const openTasks = openTasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    column_label: columnLabelMap.get(t.column_id) ?? null,
  }));
  const complianceItems = (complianceListRes.data ??
    []) as AdminOverviewData["complianceItems"];

  const urgentCompliance = complianceItems.find(
    (c) => complianceUrgency(c.expires_on) !== "ok",
  );
  const dueThisWeekTask = openTasks.find(
    (t) => t.due_date && daysUntil(t.due_date) <= 7,
  );

  const checklist = buildAdminChecklist({
    fileCount,
    openTaskCount: pendingTasksRes.count ?? 0,
    complianceTotal: complianceTotalRes.count ?? 0,
    complianceOverdue: complianceOverdueRes.count ?? 0,
    complianceDueSoon: complianceSoonRes.count ?? 0,
    urgentComplianceTitle: urgentCompliance?.title ?? null,
    dueThisWeekTaskTitle: dueThisWeekTask?.title ?? null,
    canStorage: options.canStorage,
    canTasks: options.canTasks,
    canCompliance: options.canCompliance,
  });

  return {
    fileCount,
    totalStorageBytes,
    recentFiles: (recentFilesRes.data ?? []) as AdminRecentFile[],
    categoryBreakdown: computeCategoryBreakdown(fileMeta),
    storageQuotaGb:
      storageQuotaMb != null ? Math.round((storageQuotaMb / 1024) * 100) / 100 : null,
    storageUsagePct,
    hasStorageAddon,
    openTaskCount: pendingTasksRes.count ?? 0,
    openTasks,
    complianceOverdue: complianceOverdueRes.count ?? 0,
    complianceDueSoon: complianceSoonRes.count ?? 0,
    complianceItems,
    tasksCompletedThisWeek: tasksDoneRes.count ?? 0,
    renewalsCompletedThisWeek: renewalsDoneRes.count ?? 0,
    checklist,
    hasAdminAssistant: options.hasAdminAssistant,
    notifications: (notificationsRes.data ?? []) as AdminNotificationItem[],
  };
}

export function buildAdminAiMessage(data: AdminOverviewData): string {
  if (data.complianceOverdue > 0) {
    return `${data.complianceOverdue} renewal${data.complianceOverdue === 1 ? "" : "s"} overdue and ${data.openTaskCount} open task${data.openTaskCount === 1 ? "" : "s"}. I can help you prioritise this week.`;
  }
  if (data.complianceDueSoon > 0) {
    return `${data.complianceDueSoon} renewal${data.complianceDueSoon === 1 ? "" : "s"} due within 30 days. Ask me for a weekly admin checklist.`;
  }
  if (data.openTaskCount > 0) {
    return `${data.openTaskCount} open task${data.openTaskCount === 1 ? "" : "s"} on the board — renewals look clear. I can help organise document storage.`;
  }
  return "Tasks and renewals look clear. I can help you organise document storage or set a weekly admin routine.";
}
