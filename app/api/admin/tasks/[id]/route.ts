import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface, getSurfaceScope } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminTaskUpdateSchema } from "@/lib/admin/task-compliance-schemas";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTasksUser();
  if (auth.response) return auth.response;
  const { user } = auth;

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
    parsed = adminTaskUpdateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: "validation_failed", issues: e.issues } },
        { status: 400 },
      );
    }
    throw e;
  }

  const scope = getSurfaceScope(user.role, "admin", "tasks");
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: lookupErr } = await supabase
    .from("admin_tasks")
    .select("id, assignee_user_id")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupErr || !existing) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "Task not found." },
      },
      { status: 404 },
    );
  }

  if (
    scope === "assigned_only" &&
    existing.assignee_user_id !== user.id
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "forbidden",
          message: "You can only update tasks assigned to you.",
        },
      },
      { status: 403 },
    );
  }

  if (scope === "assigned_only" && parsed.assignee_user_id !== undefined) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "forbidden",
          message: "You cannot reassign tasks.",
        },
      },
      { status: 403 },
    );
  }

  const patch: Record<string, unknown> = { ...parsed };
  if (parsed.status === "done") {
    patch.completed_at = new Date().toISOString();
  } else if (parsed.status === "todo" || parsed.status === "doing") {
    patch.completed_at = null;
  }

  const { data, error } = await supabase
    .from("admin_tasks")
    .update(patch)
    .eq("id", id)
    .eq("business_id", user.businessId)
    .select(
      "id, business_id, title, description, status, due_date, assignee_user_id, " +
        "created_by, sort_order, completed_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "update_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTasksUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  if (getSurfaceScope(user.role, "admin", "tasks") === "assigned_only") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "forbidden",
          message: "Only owners and managers can delete tasks.",
        },
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("admin_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "delete_failed", message: error.message },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
