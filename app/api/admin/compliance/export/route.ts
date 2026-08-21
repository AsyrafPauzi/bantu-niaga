import { NextResponse } from "next/server";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import {
  buildComplianceExportCsv,
  buildComplianceExportHtml,
} from "@/lib/admin/compliance-export";
import {
  COMPLIANCE_SELECT,
  enrichComplianceRows,
} from "@/lib/admin/compliance-server";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminComplianceRow } from "@/lib/admin/task-compliance-schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  if (!canSurface(user.role, "admin", "compliance")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_compliance_items")
    .select(COMPLIANCE_SELECT)
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .eq("status", "active")
    .order("expires_on", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "export_failed" },
      { status: 500 },
    );
  }

  const items = await enrichComplianceRows(
    supabase,
    (data ?? []) as unknown as AdminComplianceRow[],
  );

  if (format === "html") {
    const body = buildComplianceExportHtml(items);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="bantuniaga-licences.html"',
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = buildComplianceExportCsv(items);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bantuniaga-licences.csv"',
      "Cache-Control": "no-store",
    },
  });
}
