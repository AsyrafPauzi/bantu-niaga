import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
  type CurrentUser,
} from "@/lib/auth/current-user";
import { can } from "@/lib/permissions";
import { searchQuerySchema } from "@/lib/marketing/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireOperationsUser(): Promise<
  | { user: CurrentUser; response: null }
  | { user: null; response: NextResponse }
> {
  try {
    const user = await getCurrentUser();
    if (!can(user.role, "operations")) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: {
              code: "forbidden",
              message: "You don't have permission to access Operations.",
            },
          },
          { status: 403 },
        ),
      };
    }
    return { user, response: null };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        user: null,
        response: NextResponse.json(
          {
            ok: false,
            error: { code: "unauthorized", message: "Authentication required." },
          },
          { status: 401 },
        ),
      };
    }
    throw e;
  }
}

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

  const safe = parsed.q.replace(/[\\*,()]/g, "");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone_e164")
    .eq("business_id", user.businessId)
    .is("deleted_at", null)
    .is("merged_into_id", null)
    .or(`name.ilike.*${safe}*,phone_e164.ilike.${safe}*`)
    .order("name", { ascending: true })
    .limit(parsed.limit);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "search_failed", message: "Could not search customers." },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      phone: (row.phone_e164 as string | null) ?? null,
    })),
  });
}
