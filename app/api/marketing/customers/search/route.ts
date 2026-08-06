import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { enforceRateLimit } from "@/lib/api/enforce-rate-limit";
import { requireMarketingSurface } from "@/lib/marketing/require-user";
import { searchCustomers } from "@/lib/customers/search";
import { searchQuerySchema } from "@/lib/marketing/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMarketingSurface("customers");
  if (auth.response) return auth.response;
  const { user } = auth;

  const limited = enforceRateLimit({
    bucket: "marketing.customers.search",
    identifier: `user:${user.id}`,
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const rawParams: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    rawParams[k] = v;
  }

  let parsed;
  try {
    parsed = searchQuerySchema.parse(rawParams);
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
  try {
    const rows = await searchCustomers(supabase, {
      businessId: user.businessId,
      query: parsed.q,
      limit: parsed.limit,
      select:
        "id, name, phone_e164, total_spend_myr, last_purchase_at, auto_tags",
    });
    return NextResponse.json({ data: rows }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "search_failed", message: "Could not search customers." },
      { status: 500 },
    );
  }
}
