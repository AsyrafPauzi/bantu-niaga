import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { buildAccountantExportCsv } from "@/lib/finance/accountant-export";
import { parseFinanceMonth } from "@/lib/finance/helpers";
import { notifyFinanceExportDownloaded } from "@/lib/finance/notify";

export const dynamic = "force-dynamic";

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

  if (!can(user.role, "finance")) {
    return NextResponse.json(
      { error: "forbidden", reason: "Finance access required." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const month = parseFinanceMonth(url.searchParams.get("month"));
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "validation_failed", message: "Use month=YYYY-MM." },
      { status: 400 },
    );
  }

  try {
    const body = await buildAccountantExportCsv(user.businessId, month);
    notifyFinanceExportDownloaded({ businessId: user.businessId, month });
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bantuniaga-accountant-pack-${month}.csv"`,
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
