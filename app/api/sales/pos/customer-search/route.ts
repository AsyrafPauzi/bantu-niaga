import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canUsePos } from "@/lib/sales/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(20).optional().default(8),
});

/** GET /api/sales/pos/customer-search — cashier typeahead for POS. */
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

  if (!canUsePos(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const supabase = await createSupabaseServerClient();
  const safe = parsed.data.q.replace(/[\\*,()]/g, "");

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone_e164")
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .or(`name.ilike.*${safe}*,phone_e164.ilike.${safe}*`)
    .order("name", { ascending: true })
    .limit(parsed.data.limit);

  if (error) {
    return NextResponse.json(
      { error: "search_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 });
}
