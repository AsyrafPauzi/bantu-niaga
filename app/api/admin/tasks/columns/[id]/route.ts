import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import {
  ADMIN_TASK_COLUMN_MIN,
  adminTaskColumnDeleteSchema,
  adminTaskColumnUpdateSchema,
  loadTaskColumns,
} from "@/lib/admin/task-columns";
import { canSurface, getSurfaceScope } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

async function requireColumnsManager(): Promise<
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
    if (getSurfaceScope(user.role, "admin", "tasks") === "assigned_only") {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "Only owners and managers can manage board columns.",
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
  const auth = await requireColumnsManager();
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
    parsed = adminTaskColumnUpdateSchema.parse(body);
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
  const { data: existing, error: lookupErr } = await supabase
    .from("admin_task_columns")
    .select("id")
    .eq("id", id)
    .eq("business_id", user!.businessId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupErr || !existing) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "not_found", message: "Column not found." },
      },
      { status: 404 },
    );
  }

  if (parsed.is_done === true) {
    const admin = createServiceRoleClient();
    await admin
      .from("admin_task_columns")
      .update({ is_done: false })
      .eq("business_id", user!.businessId)
      .is("deleted_at", null)
      .neq("id", id);
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("admin_task_columns")
    .update(parsed)
    .eq("id", id)
    .eq("business_id", user!.businessId)
    .is("deleted_at", null)
    .select(
      "id, business_id, label, slug, sort_order, is_done, created_at, updated_at",
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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await requireColumnsManager();
    if (auth.response) return auth.response;
    const { user } = auth;

    const url = new URL(request.url);
    let moveToColumnId: string | undefined =
      url.searchParams.get("move_to_column_id") ?? undefined;

    if (!moveToColumnId) {
      try {
        const body = await request.json().catch(() => ({}));
        moveToColumnId = adminTaskColumnDeleteSchema.parse(body).move_to_column_id;
      } catch (e) {
        if (e instanceof ZodError) {
          return NextResponse.json(
            { ok: false, error: { code: "validation_failed", issues: e.issues } },
            { status: 400 },
          );
        }
        throw e;
      }
    }

    const supabase = await createSupabaseServerClient();
    const admin = createServiceRoleClient();
    const businessId = user!.businessId;
    const columns = await loadTaskColumns(supabase, businessId);
    const target = columns.find((c) => c.id === id);
    if (!target) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "not_found", message: "Column not found." },
        },
        { status: 404 },
      );
    }

    if (columns.length <= ADMIN_TASK_COLUMN_MIN) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "min_columns",
            message: "At least one column must remain on the board.",
          },
        },
        { status: 400 },
      );
    }

    const { count: taskCount, error: taskCountErr } = await admin
      .from("admin_tasks")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("column_id", id)
      .is("deleted_at", null);

    if (taskCountErr) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "count_failed", message: taskCountErr.message },
        },
        { status: 500 },
      );
    }

    if ((taskCount ?? 0) > 0) {
      const fallback =
        moveToColumnId ??
        columns.find((c) => c.id !== id && !c.is_done)?.id ??
        columns.find((c) => c.id !== id)?.id;

      const dest = columns.find((c) => c.id === fallback);
      if (!fallback || fallback === id || !dest) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "tasks_present",
              message:
                "This column has tasks. Choose another column to move them to.",
            },
          },
          { status: 400 },
        );
      }

      const { data: movedTasks, error: moveErr } = await admin
        .from("admin_tasks")
        .update({
          column_id: fallback,
          completed_at: dest.is_done ? new Date().toISOString() : null,
        })
        .eq("business_id", businessId)
        .eq("column_id", id)
        .is("deleted_at", null)
        .select("id");

      if (moveErr) {
        return NextResponse.json(
          {
            ok: false,
            error: { code: "move_failed", message: moveErr.message },
          },
          { status: 500 },
        );
      }

      if (!movedTasks || movedTasks.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "move_failed",
              message: "Could not move tasks out of this column.",
            },
          },
          { status: 500 },
        );
      }
    }

    const { error } = await admin
      .from("admin_task_columns")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId)
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

    const remaining = columns.filter((c) => c.id !== id);
    return NextResponse.json({ ok: true, data: remaining }, { status: 200 });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not delete column.";
    return NextResponse.json(
      {
        ok: false,
        error: { code: "internal_error", message },
      },
      { status: 500 },
    );
  }
}
