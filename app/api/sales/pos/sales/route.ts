import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canManageSalesCore } from "@/lib/sales/access";
import { malaysiaTodayYmd } from "@/lib/sales/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/sales/pos/sales — recent sales + today summary. */
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
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
  );

  const supabase = await createSupabaseServerClient();
  const today = malaysiaTodayYmd();
  const dayStart = `${today}T00:00:00.000+08:00`;
  const endDate = new Date(`${today}T00:00:00.000+08:00`);
  endDate.setDate(endDate.getDate() + 1);
  const dayEnd = endDate.toISOString();

  const [recentRes, todayRes] = await Promise.all([
    supabase
      .from("pos_sales")
      .select(
        "id, sale_number, total_myr, payment_method, customer_name, created_at, status",
      )
      .eq("business_id", user.businessId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("pos_sales")
      .select("id, total_myr, payment_method")
      .eq("business_id", user.businessId)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
  ]);

  if (recentRes.error) {
    return NextResponse.json(
      { error: "load_failed", message: recentRes.error.message },
      { status: 500 },
    );
  }

  const todayRows = todayRes.data ?? [];
  const salesToday = todayRows.reduce(
    (a, r) => a + Number(r.total_myr ?? 0),
    0,
  );

  return NextResponse.json(
    {
      data: recentRes.data ?? [],
      summary: {
        today: today,
        sales_today_myr: Number(salesToday.toFixed(2)),
        transactions_today: todayRows.length,
        cash_today_myr: Number(
          todayRows
            .filter((r) => r.payment_method === "cash")
            .reduce((a, r) => a + Number(r.total_myr ?? 0), 0)
            .toFixed(2),
        ),
        duitnow_today_myr: Number(
          todayRows
            .filter((r) => r.payment_method === "duitnow_qr_static")
            .reduce((a, r) => a + Number(r.total_myr ?? 0), 0)
            .toFixed(2),
        ),
      },
    },
    { status: 200 },
  );
}
