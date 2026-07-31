import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_BULK = 200;

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_BULK),
});

/**
 * POST /api/marketing/customers/bulk-delete
 * Soft-delete multiple customers (hidden from CRM, links preserved).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }

  if (!canSurface(user.role, "marketing", "customers")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const uniqueIds = [...new Set(parsed.data.ids)];

  let deleted = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const id of uniqueIds) {
    const { error } = await supabase.rpc("marketing_soft_delete_customer", {
      p_business_id: user.businessId,
      p_customer_id: id,
      p_actor_user_id: user.id,
    });

    if (error) {
      const msg =
        error.code === "P0001" && error.message === "not_found"
          ? "not_found"
          : error.message;
      failures.push({ id, error: msg });
      continue;
    }
    deleted += 1;
  }

  return NextResponse.json(
    {
      action: "bulk_deleted",
      requested: uniqueIds.length,
      deleted,
      failed: failures.length,
      failures: failures.length > 0 ? failures : undefined,
    },
    { status: failures.length === uniqueIds.length ? 404 : 200 },
  );
}
