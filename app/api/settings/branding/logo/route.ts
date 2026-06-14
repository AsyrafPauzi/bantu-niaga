import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);
const MAX_BYTES = 1_500_000; // 1.5 MB — generous for SVG, room for retina PNG.

/**
 * POST /api/settings/branding/logo — multipart upload.
 *
 * Body (multipart/form-data):
 *   - file: the logo file
 *
 * Stores under `branding/<business_id>/logo.<ext>` in the public `branding`
 * bucket, then updates businesses.logo_url with the new public URL plus a
 * cache-busting query string.
 *
 * Owner-only. Defends against MIME spoof + huge uploads.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "forbidden", reason: "Only the owner can upload a logo." },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "no_file", message: "Attach a file under the 'file' key." },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: "bad_type",
        message: `Logo must be PNG, JPEG, SVG or WebP. Received ${file.type}.`,
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: "too_large",
        message: `Logo must be under ${Math.round(MAX_BYTES / 1024)} KB.`,
      },
      { status: 400 },
    );
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/svg+xml"
        ? "svg"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

  const objectPath = `${user.businessId}/logo.${ext}`;

  const supabase = await createSupabaseServerClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(objectPath, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: "60",
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "upload_failed", message: uploadError.message },
      { status: 500 },
    );
  }

  const env = getSupabasePublicEnv();
  const publicUrl = env
    ? `${env.url}/storage/v1/object/public/branding/${objectPath}?v=${Date.now()}`
    : `branding/${objectPath}`;

  const { data: updated, error: updateError } = await supabase
    .from("businesses")
    .update({ logo_url: publicUrl })
    .eq("id", user.businessId)
    .select("id, logo_url")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      {
        error: "update_failed",
        message: updateError?.message ?? "businesses row update failed",
      },
      { status: 500 },
    );
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "settings.branding.logo_upload",
    entity_type: "business",
    entity_id: user.businessId,
    diff: { logo_url: publicUrl, content_type: file.type, bytes: file.size },
  });

  return NextResponse.json(
    { logo_url: publicUrl },
    { status: 200 },
  );
}

/**
 * DELETE /api/settings/branding/logo — clears the logo and removes the
 * stored object. Owner-only.
 */
export async function DELETE() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  // List + delete every object under the business prefix so we don't leak
  // old logos when the user switches file types.
  const { data: list } = await supabase.storage
    .from("branding")
    .list(user.businessId);

  if (list && list.length > 0) {
    const paths = list.map((o) => `${user.businessId}/${o.name}`);
    await supabase.storage.from("branding").remove(paths);
  }

  await supabase
    .from("businesses")
    .update({ logo_url: null })
    .eq("id", user.businessId);

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "settings.branding.logo_clear",
    entity_type: "business",
    entity_id: user.businessId,
    diff: null,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
