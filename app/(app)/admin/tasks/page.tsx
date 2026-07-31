import { redirect } from "next/navigation";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminSubpageShell } from "@/components/admin/AdminSubpageShell";
import { AdminTaskBoard } from "@/components/admin/AdminTaskBoard";
import { ModuleHeroStat } from "@/components/dashboard/module-layout";
import { Card, CardBody } from "@/components/ui/card";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { loadTaskColumns } from "@/lib/admin/task-columns";
import { enrichAdminTasks } from "@/lib/admin/tasks-enrich";
import { canSurface, getSurfaceScope } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminTaskRow } from "@/lib/admin/task-compliance-schemas";

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function flattenParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.length > 0) out[k] = v[0];
  }
  return out;
}

function malaysiaTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

export default async function TasksPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "admin", "tasks")) {
    return (
      <div className="space-y-4">
        <AdminBackLink />
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-ink-muted dark:text-cream-400">
              You don&apos;t have access to Admin tasks.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const scope = getSurfaceScope(user.role, "admin", "tasks");
  const canManage = scope === "*";
  const canAttachStorage = canSurface(user.role, "admin", "storage");
  const params = flattenParams(await searchParams);
  const initialOpenTaskId = params.task?.trim() || null;
  const today = malaysiaTodayIso();

  const [initialColumns, tasksRes, teamRaw] = await Promise.all([
    loadTaskColumns(supabase, user.businessId),
    (async () => {
      let query = supabase
        .from("admin_tasks")
        .select(
          "id, business_id, title, description, column_id, due_date, assignee_user_id, " +
            "admin_file_id, created_by, sort_order, completed_at, created_at, updated_at",
        )
        .eq("business_id", user.businessId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (scope === "assigned_only") {
        query = query.eq("assignee_user_id", user.id);
      }
      return query;
    })(),
    supabase
      .from("users")
      .select("id, display_name, email")
      .eq("business_id", user.businessId)
      .order("display_name", { ascending: true }),
  ]);

  const { data: tasks, error } = tasksRes;
  const rows = (tasks ?? []) as unknown as AdminTaskRow[];
  const enriched = await enrichAdminTasks(supabase, user.businessId, rows);

  const openCount = enriched.filter((t) => !t.completed_at).length;
  const dueToday = enriched.filter(
    (t) => !t.completed_at && t.due_date === today,
  ).length;
  const overdue = enriched.filter(
    (t) => !t.completed_at && t.due_date && t.due_date < today,
  ).length;

  const doneCount = enriched.filter((t) => t.completed_at).length;

  const heroHeadline =
    overdue > 0
      ? `${overdue} task${overdue === 1 ? "" : "s"} past due`
      : openCount > 0
        ? `${openCount} open on the board`
        : "Clear board — add your first task";

  const heroSub =
    overdue > 0
      ? "Drag cards forward or set a new due date before things slip."
      : openCount > 0
        ? "Columns match your workflow — drag, rename, or add tasks inline."
        : "Capture daily admin work so renewals and filings stay on track.";

  const teamMembers = (teamRaw.data ?? []).map(
    (m: { id: string; display_name: string | null; email: string | null }) => ({
      id: m.id,
      label: m.display_name || m.email || m.id.slice(0, 8),
    }),
  );

  if (error) {
    return (
      <div className="space-y-4">
        <AdminBackLink />
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load tasks: {error.message}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <AdminSubpageShell
      headline={heroHeadline}
      subcopy={heroSub}
      variant={overdue > 0 ? "attention" : "calm"}
      stats={
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <ModuleHeroStat
            label="Open"
            value={openCount}
            iconClassName="text-violet-700 dark:text-violet-300"
          />
          <ModuleHeroStat
            label="Due today"
            value={dueToday}
            iconClassName="text-amber-700 dark:text-amber-300"
          />
          <ModuleHeroStat
            label="Overdue"
            value={overdue}
            iconClassName="text-rose-700 dark:text-rose-300"
          />
          <ModuleHeroStat
            label="Completed"
            value={doneCount}
            iconClassName="text-emerald-700 dark:text-emerald-300"
          />
        </div>
      }
    >
      <AdminTaskBoard
        initialTasks={enriched}
        initialColumns={initialColumns}
        teamMembers={teamMembers}
        canManage={canManage}
        canAttachStorage={canAttachStorage}
        initialOpenTaskId={initialOpenTaskId}
      />
    </AdminSubpageShell>
  );
}
