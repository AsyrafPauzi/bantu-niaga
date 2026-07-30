import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  billingUsageToCsv,
  loadBillingUsageReport,
} from "@/lib/settings/billing-usage";

export const dynamic = "force-dynamic";

function defaultMonthRange(): { from: string; to: string } {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

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

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const defaults = defaultMonthRange();
  const from = url.searchParams.get("from") ?? defaults.from;
  const to = url.searchParams.get("to") ?? defaults.to;

  try {
    const report = await loadBillingUsageReport(user.businessId, from, to);

    if (format === "csv") {
      const body = billingUsageToCsv(report);
      const stamp = from.slice(0, 10);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="bantuniaga-usage-${stamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(report, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        error: "usage_report_failed",
        message: e instanceof Error ? e.message : "Could not load usage report",
      },
      { status: 500 },
    );
  }
}
