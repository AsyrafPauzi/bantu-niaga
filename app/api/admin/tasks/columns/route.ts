import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import {
  ADMIN_TASK_COLUMN_MAX,
  adminTaskColumnCreateSchema,
  loadTaskColumns,
  slugifyTaskColumnLabel,
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

export async function GET() {
  const auth = await requireColumnsManager();
  if (auth.response) return auth.response;

  const supabase = await createSupabaseServerClient();
  try {
    const columns = await loadTaskColumns(supabase, auth.user!.businessId);
    return NextResponse.json({ ok: true, data: columns }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "list_failed",
          message: e instanceof Error ? e.message : "Could not load columns.",
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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
    parsed = adminTaskColumnCreateSchema.parse(body);
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
  const existing = await loadTaskColumns(supabase, user!.businessId);
  if (existing.length >= ADMIN_TASK_COLUMN_MAX) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "limit_reached",
          message: `You can have at most ${ADMIN_TASK_COLUMN_MAX} columns.`,
        },
      },
      { status: 400 },
    );
  }

  const sortOrder =
    existing.length > 0
      ? Math.max(...existing.map((c) => c.sort_order)) + 1
      : 0;

  if (parsed.is_done) {
    const admin = createServiceRoleClient();
    await admin
      .from("admin_task_columns")
      .update({ is_done: false })
      .eq("business_id", user!.businessId)
      .is("deleted_at", null);
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("admin_task_columns")
    .insert({
      business_id: user!.businessId,
      label: parsed.label,
      slug: slugifyTaskColumnLabel(parsed.label),
      sort_order: sortOrder,
      is_done: parsed.is_done,
    })
    .select(
      "id, business_id, label, slug, sort_order, is_done, created_at, updated_at",
    )
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

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
