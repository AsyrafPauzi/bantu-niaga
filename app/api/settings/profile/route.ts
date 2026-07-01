import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/settings/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  email: string | null;
  role: string;
};

type ProfileDiff = Partial<
  Record<"display_name" | "phone_e164", { before: string | null; after: string | null }>
>;

const SAFE_PROFILE_SELECT = "id, display_name, phone_e164, email, role";

function hasOwn<T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function safeProfile(row: ProfileRow) {
  return {
    id: row.id,
    display_name: row.display_name,
    phone_e164: row.phone_e164,
    email: row.email,
    role: row.role,
  };
}

export async function PATCH(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = profileUpdateSchema.parse(body);
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

  const { data: current, error: loadError } = await supabase
    .from("users")
    .select(SAFE_PROFILE_SELECT)
    .eq("id", user.id)
    .eq("business_id", user.businessId)
    .maybeSingle();

  if (loadError) {
    console.error("profile update load failed", loadError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const currentProfile = current as ProfileRow;
  const updates: Partial<Pick<ProfileRow, "display_name" | "phone_e164">> = {};
  const diff: ProfileDiff = {};

  if (hasOwn(parsed, "display_name")) {
    const nextDisplayName = parsed.display_name;
    if (
      typeof nextDisplayName === "string" &&
      nextDisplayName !== currentProfile.display_name
    ) {
      updates.display_name = nextDisplayName;
      diff.display_name = {
        before: currentProfile.display_name,
        after: nextDisplayName,
      };
    }
  }

  if (hasOwn(parsed, "phone_e164")) {
    const nextPhone = parsed.phone_e164 ?? null;
    if (nextPhone !== currentProfile.phone_e164) {
      updates.phone_e164 = nextPhone;
      diff.phone_e164 = {
        before: currentProfile.phone_e164,
        after: nextPhone,
      };
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: true, profile: safeProfile(currentProfile) },
      { status: 200 },
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .eq("business_id", user.businessId)
    .select(SAFE_PROFILE_SELECT)
    .single();

  if (updateError || !updated) {
    console.error("profile update failed", updateError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "settings.profile.update",
    entity_type: "user",
    entity_id: user.id,
    diff,
  });

  if (auditError) {
    console.error("profile update audit failed", auditError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, profile: safeProfile(updated as ProfileRow) },
    { status: 200 },
  );
}
