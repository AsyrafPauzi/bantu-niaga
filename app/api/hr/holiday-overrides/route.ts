import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import { loadHrHolidayOverrides } from "@/lib/hr/effective-calendar";
import { hasPublicHolidaysAddon } from "@/lib/marketplace/entitlements";
import { holidayOverrideCreateSchema } from "@/lib/hr/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireHrUser() {
  try {
    const user = await getCurrentUser();
    if (!canManageHrCore(user.role)) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "forbidden", reason: "hr access denied" },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          { error: "unauthorized", code: error.code },
          { status: 401 },
        ),
      };
    }
    throw error;
  }
}

export async function GET() {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const addonActive = await hasPublicHolidaysAddon(user.businessId);
  if (!addonActive) {
    return NextResponse.json(
      {
        error: "addon_required",
        message:
          "Activate Public Holiday Calendar in the Marketplace to manage overrides.",
        marketplace_href: "/marketplace",
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const overrides = await loadHrHolidayOverrides(supabase, user.businessId);
  return NextResponse.json({ data: overrides }, { status: 200 });
}

export async function POST(request: Request) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const addonActive = await hasPublicHolidaysAddon(user.businessId);
  if (!addonActive) {
    return NextResponse.json(
      {
        error: "addon_required",
        message:
          "Activate Public Holiday Calendar in the Marketplace to add overrides.",
        marketplace_href: "/marketplace",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = holidayOverrideCreateSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.replaces_holiday_id) {
    const { data: holiday } = await supabase
      .from("hr_public_holidays")
      .select("id")
      .eq("id", parsed.replaces_holiday_id)
      .maybeSingle();

    if (!holiday) {
      return NextResponse.json(
        { error: "validation_failed", message: "Holiday not found." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("business_holiday_overrides")
    .insert({
      business_id: user.businessId,
      override_type: parsed.override_type,
      holiday_date: parsed.holiday_date,
      replaces_holiday_id: parsed.replaces_holiday_id ?? null,
      name: parsed.name?.trim() || null,
      notes: parsed.notes ?? null,
      created_by_user_id: user.id,
    })
    .select(
      "id, override_type, holiday_date, replaces_holiday_id, name, notes, created_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "create_failed", message: "Could not save override." },
      { status: 500 },
    );
  }

  return NextResponse.json({ override: data }, { status: 201 });
}
