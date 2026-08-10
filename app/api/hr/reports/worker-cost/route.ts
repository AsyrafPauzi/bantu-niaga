import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageHrCore } from "@/lib/hr/access";
import {
  loadWorkerCostReport,
  workerCostReportToCsv,
} from "@/lib/hr/worker-cost";

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

function defaultMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function GET(request: Request) {
  const { user, response } = await requireHrUser();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? defaultMonth();
  const format = searchParams.get("format") ?? "json";

  try {
    const report = await loadWorkerCostReport(user!.businessId, month);

    if (format === "csv") {
      const csv = workerCostReportToCsv(report);
      const filename = `worker-cost-${report.month}.csv`;
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ data: report }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_month") {
      return NextResponse.json(
        { error: "invalid_month", message: "Use YYYY-MM format." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "report_failed" }, { status: 500 });
  }
}
