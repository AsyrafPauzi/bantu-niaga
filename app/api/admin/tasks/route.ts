import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface, getSurfaceScope } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adminTaskCreateSchema,
  type AdminTaskRow,
} from "@/lib/admin/task-compliance-schemas";
import {
  columnIsDone,
  enrichAdminTasks,
  resolveDefaultTaskColumnId,
} from "@/lib/admin/tasks-enrich";
import { assertAdminFileOwned } from "@/lib/admin/validate-admin-file";

export const dynamic = "force-dynamic";

async function requireTasksUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "admin", "tasks")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You don't have permission to access Admin tasks.",
            },
          },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: { code: "unauthorized", message: "Authentication required." },
          },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

const TASK_SELECT =
  "id, business_id, title, description, column_id, due_date, assignee_user_id, " +
  "admin_file_id, created_by, sort_order, completed_at, created_at, updated_at";

export async function GET() {
  const auth = await requireTasksUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("admin_tasks")
    .select(TASK_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const scope = getSurfaceScope(user.role, "admin", "tasks");
  if (scope === "assigned_only") {
    query = query.eq("assignee_user_id", user.id);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "list_failed" },
      },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as AdminTaskRow[];
  const enriched = await enrichAdminTasks(supabase, user.businessId, rows);

  return NextResponse.json({ ok: true, data: enriched }, { status: 200 });
}

export async function POST(request: Request) {
  const auth = await requireTasksUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  if (getSurfaceScope(user.role, "admin", "tasks") === "assigned_only") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "forbidden",
          message: "Only owners and managers can create tasks.",
        },
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "invalid_json", message: "Invalid JSON body." },
      },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = adminTaskCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: "validation_failed", issues: e.issues } },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const columnId =
    parsed.column_id ??
    (await resolveDefaultTaskColumnId(supabase, user.businessId));
  const isDone = await columnIsDone(supabase, user.businessId, columnId);

  if (parsed.admin_file_id) {
    const owned = await assertAdminFileOwned(
      supabase,
      user.businessId,
      parsed.admin_file_id,
    );
    if (!owned) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "file_not_found", message: "Storage file not found." },
        },
        { status: 404 },
      );
    }
  }

  const { data, error } = await supabase
    .from("admin_tasks")
    .insert({
      business_id: user.businessId,
      title: parsed.title,
      description: parsed.description ?? null,
      column_id: columnId,
      due_date: parsed.due_date ?? null,
      assignee_user_id: parsed.assignee_user_id ?? null,
      admin_file_id: parsed.admin_file_id ?? null,
      created_by: user.id,
      completed_at: isDone ? new Date().toISOString() : null,
    })
    .select(TASK_SELECT)
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "create_failed" },
      },
      { status: 500 },
    );
  }

  const [enriched] = await enrichAdminTasks(supabase, user.businessId, [
    data as unknown as AdminTaskRow,
  ]);

  return NextResponse.json({ ok: true, data: enriched }, { status: 201 });
}
