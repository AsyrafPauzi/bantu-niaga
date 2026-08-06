import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { searchCustomers } from "@/lib/customers/search";
import { canUsePos } from "@/lib/sales/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  try {
    const rows = await searchCustomers(supabase, {
      businessId: user.businessId,
      query: parsed.data.q,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ data: rows }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "search_failed", message: "Could not search customers." },
      { status: 500 },
    );
  }
}
