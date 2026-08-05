import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  buildPosSalesExportCsv,
  parseSalesExportPeriod,
} from "@/lib/sales/pos-export";
import { canManageSalesCore } from "@/lib/sales/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifySalesExportDownloaded } from "@/lib/sales/notify";

export const dynamic = "force-dynamic";

const exportQuerySchema = z.object({
  period: z.enum(["today", "week", "month"]).optional(),
});

export async function GET(request: Request) {
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

  if (!canManageSalesCore(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = exportQuerySchema.safeParse({
    period: url.searchParams.get("period") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", message: "Use period=today|week|month." },
      { status: 400 },
    );
  }

  const period = parseSalesExportPeriod(parsed.data.period);

  try {
    const supabase = await createSupabaseServerClient();
    const body = await buildPosSalesExportCsv(
      supabase,
      user.businessId,
      period,
    );

    notifySalesExportDownloaded({ businessId: user.businessId });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bantuniaga-pos-${period}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "export_failed",
        message: e instanceof Error ? e.message : "Export failed",
      },
      { status: 500 },
    );
  }
}
