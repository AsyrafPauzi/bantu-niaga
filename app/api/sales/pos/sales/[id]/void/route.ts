import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { voidPosSale } from "@/lib/sales/void-sale";
import { notifySalesPosVoided } from "@/lib/sales/notify";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const voidSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/sales/pos/sales/[id]/void — manager/owner void a completed sale. */
export async function POST(request: Request, context: RouteContext) {
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

  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = voidSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();

  const { data: saleRow } = await supabase
    .from("pos_sales")
    .select("sale_number")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .maybeSingle();

  const result = await voidPosSale({
    supabase,
    businessId: user.businessId,
    userId: user.id,
    saleId: id,
    reason: parsed.reason,
  });

  if (!result.ok) {
    const status =
      result.error === "sale_not_found"
        ? 404
        : result.error === "already_voided"
          ? 409
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (saleRow?.sale_number) {
    notifySalesPosVoided({
      businessId: user.businessId,
      saleId: id,
      saleNumber: saleRow.sale_number as string,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
