import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { loadAdminInternalNotes } from "@/lib/admin/notes-load";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

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
            message: "Only owners and managers can use internal notes.",
          },
        },
        { status: 403 },
      ),
    };
  }
  return { user, response: null as null };
}

export async function GET() {
  try {
    await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "Authentication required." } },
        { status: 401 },
      );
    }
    throw e;
  }

  const auth = await requireNotesAccess();
  if (auth.response) return auth.response;

  const supabase = await createSupabaseServerClient();
  const notes = await loadAdminInternalNotes(supabase, auth.user!.businessId);

  return NextResponse.json({ ok: true, data: notes });
}

export async function POST(request: Request) {
  try {
    await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "Authentication required." } },
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

  let parsed: z.infer<typeof createSchema>;
  try {
    parsed = createSchema.parse(body);
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
  const { data, error } = await supabase
    .from("admin_internal_notes")
    .insert({
      business_id: auth.user!.businessId,
      body: parsed.body,
      created_by: auth.user!.id,
    })
    .select("id, body, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: { code: "insert_failed", message: error?.message ?? "Could not save note." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
