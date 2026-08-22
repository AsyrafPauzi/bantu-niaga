import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireFinanceUser } from "@/lib/finance/require-user";
import { recordInvoicePayment } from "@/lib/finance/invoice-payment";

export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  amount_myr: z.coerce.number().positive("Amount must be greater than 0."),
  payment_method: z.string().max(40).optional().nullable(),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireFinanceUser();
  if (auth.response) return auth.response;
  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Invalid JSON." } },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = paymentSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: "validation_failed", issues: e.issues } },
        { status: 400 },
      );
    }
    throw e;
  }

  const supabase = await createSupabaseServerClient();
  const result = await recordInvoicePayment(supabase, {
    invoiceId: id,
    businessId: user.businessId,
    userId: user.id,
    amountMyr: parsed.amount_myr,
    paymentMethod: parsed.payment_method ?? null,
    paymentDate: parsed.payment_date,
    notes: parsed.notes ?? null,
  });

  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "exceeds_balance" || result.reason === "invalid_amount"
          ? 422
          : result.reason === "already_paid" || result.reason === "void"
            ? 409
            : 500;
    return NextResponse.json(
      { ok: false, error: { code: result.reason, message: result.message } },
      { status },
    );
  }

  return NextResponse.json({ ok: true, data: result }, { status: 201 });
}
