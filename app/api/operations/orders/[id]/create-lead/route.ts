import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { createLeadFromOrder } from "@/lib/operations/order-lead";
import { canUseLeads } from "@/lib/sales/access";
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

  if (!can(user.role, "operations") || !canUseLeads(user.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id: orderId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const result = await createLeadFromOrder(supabase, {
    businessId: user.businessId,
    orderId,
    userId: user.id,
    canLeads: true,
  });

  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "no_phone"
          ? 400
          : result.reason === "forbidden"
            ? 403
            : 500;
    return NextResponse.json(
      {
        ok: false,
        error: result.reason,
        message:
          result.reason === "no_phone"
            ? "Add a customer phone on the order before creating a lead."
            : "Could not create lead.",
      },
      { status },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        lead_id: result.leadId,
        created: result.created,
        href: result.href,
      },
    },
    { status: result.created ? 201 : 200 },
  );
}
