import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireOperationsUser } from "@/lib/operations/require-user";
import { searchCustomers } from "@/lib/customers/search";
import { searchQuerySchema } from "@/lib/marketing/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperationsUser();
  if (auth.response) return auth.response;
  const { user } = auth;

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
        {
          ok: false,
          error: { code: "validation_failed", message: "Invalid search query." },
        },
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
    });
    return NextResponse.json({
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone_e164,
      })),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "search_failed", message: "Could not search customers." },
      },
      { status: 500 },
    );
  }
}
