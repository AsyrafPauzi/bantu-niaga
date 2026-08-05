import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { adminNotePatchSchema } from "@/lib/admin/notes-schemas";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireNotesAccess() {
  const user = await getCurrentUser();
  if (user.role !== "owner" && user.role !== "manager") {
    return {
      user: null as null,
      response: NextResponse.json(
        {
          ok: false,
          error: {
            code: "forbidden",
            message: "Only owners and managers can manage internal notes.",
          },
        },
        { status: 403 },
      ),
    };
  }
  return { user, response: null as null };
}

async function assertLinkOwnership(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessId: string,
  parsed: z.infer<typeof adminNotePatchSchema>,
) {
  if (parsed.linked_task_id) {
    const { data } = await supabase
      .from("admin_tasks")
      .select("id")
      .eq("id", parsed.linked_task_id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) {
      return "Task not found.";
    }
  }

  if (parsed.linked_compliance_id) {
    const { data } = await supabase
      .from("admin_compliance_items")
      .select("id")
      .eq("id", parsed.linked_compliance_id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) {
      return "Compliance item not found.";
    }
  }

  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "unauthorized", message: "Authentication required." },
        },
        { status: 401 },
      );
    }
    throw e;
  }

  const auth = await requireNotesAccess();
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Invalid JSON." } },
      { status: 400 },
    );
  }

  let parsed: z.infer<typeof adminNotePatchSchema>;
  try {
    parsed = adminNotePatchSchema.parse(body);
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
  const linkError = await assertLinkOwnership(
    supabase,
    auth.user!.businessId,
    parsed,
  );
  if (linkError) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_link", message: linkError } },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.body !== undefined) patch.body = parsed.body;
  if (parsed.is_pinned !== undefined) patch.is_pinned = parsed.is_pinned;
  if (parsed.linked_task_id !== undefined) {
    patch.linked_task_id = parsed.linked_task_id;
    if (parsed.linked_task_id) patch.linked_compliance_id = null;
  }
  if (parsed.linked_compliance_id !== undefined) {
    patch.linked_compliance_id = parsed.linked_compliance_id;
    if (parsed.linked_compliance_id) patch.linked_task_id = null;
  }

  const { data, error } = await supabase
    .from("admin_internal_notes")
    .update(patch)
    .eq("id", id)
    .eq("business_id", auth.user!.businessId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "update_failed", message: error.message } },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Note not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "unauthorized", message: "Authentication required." },
        },
        { status: 401 },
      );
    }
    throw e;
  }

  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "forbidden",
          message: "Only owners and managers can delete internal notes.",
        },
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("admin_internal_notes")
    .delete()
    .eq("id", id)
    .eq("business_id", user.businessId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "delete_failed", message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
