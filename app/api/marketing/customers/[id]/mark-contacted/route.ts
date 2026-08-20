import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMarketingSurface } from "@/lib/marketing/require-user";
import { touchCustomerLastContacted } from "@/lib/marketing/last-contacted";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

/**
 * POST /api/marketing/customers/[id]/mark-contacted
 *
 * Optimistic CTC stamp when the owner opens WhatsApp from desk/profile.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMarketingSurface("customers");
  if (auth.response) return auth.response;
  const user = auth.user!;

  const { id } = await params;
  const parsedId = IdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsedId.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const at = new Date();

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", user.businessId)
    .eq("id", parsedId.data)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await touchCustomerLastContacted(
      supabase,
      user.businessId,
      parsedId.data,
      at,
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: "update_failed",
        message: e instanceof Error ? e.message : "Could not update contact.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    last_contacted_at: at.toISOString(),
  });
}
