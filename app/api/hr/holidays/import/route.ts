import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { writeAuditLog } from "@/lib/audit/log";
import { canManageHrCore } from "@/lib/hr/access";
import {
  dedupeImportedHolidays,
  fetchMalaysiaHolidays,
} from "@/lib/hr/holiday-import";
import { hasPublicHolidaysAddon } from "@/lib/marketplace/entitlements";
import { loadBusiness } from "@/lib/settings/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  if (!canManageHrCore(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const addonActive = await hasPublicHolidaysAddon(user.businessId);
  if (!addonActive) {
    return NextResponse.json(
      {
        error: "addon_required",
        message: "Activate Public Holiday Calendar in the Marketplace first.",
        marketplace_href: "/marketplace",
      },
      { status: 403 },
    );
  }

  const business = await loadBusiness(user.businessId);
  if (!business?.state_code) {
    return NextResponse.json(
      {
        error: "state_required",
        message: "Set your business state in Settings before importing holidays.",
      },
      { status: 400 },
    );
  }

  let year = new Date().getFullYear();
  try {
    const body = await request.json();
    if (body?.year && Number.isInteger(body.year)) {
      year = body.year;
    }
  } catch {
    // default year
  }

  const supabase = await createSupabaseServerClient();
  const imported = dedupeImportedHolidays(
    await fetchMalaysiaHolidays(year, business.state_code),
  );

  if (imported.length === 0) {
    return NextResponse.json(
      { error: "import_empty", message: "No holidays returned for this state and year." },
      { status: 502 },
    );
  }

  let inserted = 0;
  let skipped = 0;
  const source = imported[0]?.source ?? "mycal";

  for (const row of imported) {
    const { error } = await supabase.from("hr_public_holidays").insert({
      business_id: user.businessId,
      holiday_date: row.holiday_date,
      name: row.name,
      state_code: row.state_code,
      source: row.source,
      external_id: row.external_id,
    });

    if (error) {
      if (error.code === "23505") {
        skipped += 1;
        continue;
      }
      return NextResponse.json(
        { error: "import_failed", message: "Could not save imported holidays." },
        { status: 500 },
      );
    }
    inserted += 1;
  }

  await writeAuditLog(supabase, {
    businessId: user.businessId,
    actorUserId: user.id,
    action: "hr.holidays.import",
    entityType: "hr_public_holidays",
    diff: { year, state_code: business.state_code, inserted, skipped, source },
  });

  return NextResponse.json(
    {
      imported: inserted,
      skipped,
      year,
      state_code: business.state_code,
      source,
    },
    { status: 200 },
  );
}
