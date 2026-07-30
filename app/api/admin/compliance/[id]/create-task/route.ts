import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveDefaultTaskColumnId } from "@/lib/admin/tasks-enrich";
import type { AdminTaskRow } from "@/lib/admin/task-compliance-schemas";

export const dynamic = "force-dynamic";

async function requireComplianceUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!canSurface(user.role, "admin", "compliance")) {
      return {
        user: null,
        response: NextResponse.json(
          { ok: false, error: { code: "forbidden", message: "Forbidden." } },
          { status: 403 },
        ),
      };
    }
    if (!canSurface(user.role, "admin", "tasks")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You need task access to create a renewal task.",
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
          { ok: false, error: { code: "unauthorized", message: "Auth required." } },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

function fmtDue(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysBefore(iso: string, offset: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireComplianceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  const supabase = await createSupabaseServerClient();
  const { data: item, error: fetchErr } = await supabase
    .from("admin_compliance_items")
    .select("id, title, expires_on, authority, last_renewed_at")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .eq("status", "active")
    .single();

  if (fetchErr || !item) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Licence not found." } },
      { status: 404 },
    );
  }

  const expiresOn = String(item.expires_on);
  const renewedDaysAgo = daysSince(
    item.last_renewed_at ? String(item.last_renewed_at) : null,
  );
  const recentlyRenewed =
    renewedDaysAgo !== null && renewedDaysAgo >= 0 && renewedDaysAgo <= 30;

  const title = recentlyRenewed
    ? `Prep renewal: ${item.title} (due ${fmtDue(expiresOn)})`
    : `Renew ${item.title} by ${fmtDue(expiresOn)}`;

  const dueDate = recentlyRenewed
    ? daysBefore(expiresOn, 30)
    : expiresOn;

  const description = recentlyRenewed
    ? `Licence was renewed recently. Start paperwork ~30 days before the next expiry (${fmtDue(expiresOn)}).`
    : item.authority
      ? `Renewal task for ${item.authority} licence.`
      : "Renewal task from compliance tracker.";

  const { data: existing } = await supabase
    .from("admin_tasks")
    .select("id, title")
    .eq("business_id", user.businessId)
    .eq("title", title)
    .is("deleted_at", null)
    .is("completed_at", null)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      message:
        "An open task with this title already exists on your board.",
      data: existing as unknown as AdminTaskRow,
      task_url: "/admin/tasks",
    });
  }

  const columnId = await resolveDefaultTaskColumnId(supabase, user.businessId);

  const { data: task, error } = await supabase
    .from("admin_tasks")
    .insert({
      business_id: user.businessId,
      title,
      description,
      column_id: columnId,
      due_date: dueDate,
      created_by: user.id,
      sort_order: 0,
    })
    .select(
      "id, business_id, title, description, column_id, due_date, assignee_user_id, " +
        "created_by, sort_order, completed_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "create_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      duplicate: false,
      recently_renewed: recentlyRenewed,
      message: recentlyRenewed
        ? `Future prep reminder added — due ${fmtDue(dueDate)} (30 days before expiry).`
        : `Renewal task added — due ${fmtDue(dueDate)}.`,
      data: task as unknown as AdminTaskRow,
      task_url: "/admin/tasks",
    },
    { status: 201 },
  );
}
