import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { AdminTaskBoard } from "@/components/admin/AdminTaskBoard";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface, getSurfaceScope } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminTaskRow } from "@/lib/admin/task-compliance-schemas";

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/sign-in");
    throw e;
  }

  if (!canSurface(user.role, "admin", "tasks")) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin"
          title="To-do list"
          description="Track daily tasks so nothing slips through the cracks."
        />
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

  let query = supabase
    .from("admin_tasks")
    .select(
      "id, business_id, title, description, status, due_date, assignee_user_id, " +
        "created_by, sort_order, completed_at, created_at, updated_at",
    )
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (scope === "assigned_only") {
    query = query.eq("assignee_user_id", user.id);
  }

  const { data: tasks, error } = await query;
  const rows = (tasks ?? []) as unknown as AdminTaskRow[];

  const assigneeIds = Array.from(
    new Set(rows.map((r) => r.assignee_user_id).filter(Boolean)),
  ) as string[];
  const nameLookup = new Map<string, string | null>();
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from("users")
      .select("id, display_name, email")
      .in("id", assigneeIds);
    for (const p of (profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
      email: string | null;
    }>) {
      nameLookup.set(p.id, p.display_name || p.email);
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    assignee_name: r.assignee_user_id
      ? (nameLookup.get(r.assignee_user_id) ?? null)
      : null,
  }));

  const { data: teamRaw } = await supabase
    .from("users")
    .select("id, display_name, email")
    .eq("business_id", user.businessId)
    .order("display_name", { ascending: true });

  const teamMembers = (teamRaw ?? []).map(
    (m: { id: string; display_name: string | null; email: string | null }) => ({
      id: m.id,
      label: m.display_name || m.email || m.id.slice(0, 8),
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="To-do list"
        description="Simple daily tasks — tap a card to move it To do → Doing → Done."
      />

      {error ? (
        <Card>
          <CardBody className="text-sm text-status-danger">
            Failed to load tasks: {error.message}
          </CardBody>
        </Card>
      ) : (
        <AdminTaskBoard
          initialTasks={enriched}
          teamMembers={teamMembers}
          canManage={canManage}
        />
      )}
    </div>
  );
}
