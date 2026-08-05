import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { recordExpenseFromOrder } from "@/lib/operations/order-expense";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  if (!can(user.role, "operations") || !can(user.role, "finance")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id: orderId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const result = await recordExpenseFromOrder(supabase, {
    businessId: user.businessId,
    orderId,
    userId: user.id,
    canFinance: true,
  });

  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "already_recorded"
          ? 409
          : result.reason === "no_amount"
            ? 400
            : 500;
    return NextResponse.json(
      {
        ok: false,
        error: result.reason,
        message:
          result.reason === "no_amount"
            ? "Set an order amount before recording an expense."
            : result.reason === "already_recorded"
              ? "An expense is already linked to this order."
              : "Could not create expense.",
        expense_id: result.expenseId,
        href: result.href,
      },
      { status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: { expense_id: result.expenseId, href: result.href },
    },
    { status: 201 },
  );
}
