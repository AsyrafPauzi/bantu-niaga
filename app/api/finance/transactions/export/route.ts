import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { parseFinanceMonth } from "@/lib/finance/helpers";
import { buildFinanceTransactionExportCsv } from "@/lib/finance/transaction-export";
import { FINANCE_TXN_KINDS } from "@/lib/finance/schemas";
import { can } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const exportQuerySchema = z.object({
  month: z.string().optional(),
  kind: z.enum(FINANCE_TXN_KINDS),
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

  if (!can(user.role, "finance")) {
    return NextResponse.json(
      { error: "forbidden", reason: "Finance access required." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const parsed = exportQuerySchema.safeParse({
    month: url.searchParams.get("month") ?? undefined,
    kind: url.searchParams.get("kind"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        message: "Use kind=income|expense and optional month=YYYY-MM.",
      },
      { status: 400 },
    );
  }

  const month = parseFinanceMonth(parsed.data.month);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "validation_failed", message: "Use month=YYYY-MM." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const body = await buildFinanceTransactionExportCsv(
      supabase,
      user.businessId,
      month,
      parsed.data.kind,
    );

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bantuniaga-${parsed.data.kind}-${month}.csv"`,
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
