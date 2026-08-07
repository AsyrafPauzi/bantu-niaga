import { requireMarketingSurface } from "@/lib/marketing/require-user";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contentMediaAttachSchema } from "@/lib/marketing/schemas";

/**
 * POST /api/marketing/content/[id]/media — attach a marketing_files row
 * to a content_plan entry via content_plan_media.
 *
 * DELETE — detach by ?file_id=…
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireMarketingSurface("content");
  if (auth.response) return auth.response;
  const user = auth.user!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = contentMediaAttachSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();

  const { data: entry, error: lookupErr } = await supabase
    .from("content_plan")
    .select("id")
    .eq("business_id", user.businessId)
    .eq("id", id)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json(
      { error: "load_failed", message: lookupErr.message },
      { status: 500 },
    );
  }
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: fileRow, error: fileErr } = await supabase
    .from("marketing_files")
    .select("id")
    .eq("business_id", user.businessId)
    .eq("id", parsed.file_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fileErr) {
    return NextResponse.json(
      { error: "file_lookup_failed", message: fileErr.message },
      { status: 500 },
    );
  }
  if (!fileRow) {
    return NextResponse.json(
      {
        error: "invalid_file_id",
        message: "file_id must be an uploaded marketing media file in this business.",
      },
      { status: 422 },
    );
  }

  const { data, error } = await supabase
    .from("content_plan_media")
    .upsert(
      {
        content_plan_id: id,
        file_id: parsed.file_id,
        business_id: user.businessId,
        position: parsed.position ?? 0,
      },
      { onConflict: "content_plan_id,file_id" },
    )
    .select("content_plan_id, file_id, position")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "attach_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { action: "attached", media: data },
    { status: 201 },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireMarketingSurface("content");
  if (auth.response) return auth.response;
  const user = auth.user!;

  const url = new URL(request.url);
  const fileId = url.searchParams.get("file_id");
  if (!fileId) {
    return NextResponse.json(
      {
        error: "validation_failed",
        message: "?file_id=… is required",
      },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("content_plan_media")
    .delete()
    .eq("business_id", user.businessId)
    .eq("content_plan_id", id)
    .eq("file_id", fileId);

  if (error) {
    return NextResponse.json(
      { error: "detach_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { action: "detached", content_plan_id: id, file_id: fileId },
    { status: 200 },
  );
}
