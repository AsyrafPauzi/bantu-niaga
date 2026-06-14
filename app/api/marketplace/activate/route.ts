import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z
  .object({
    slug: z.string().min(2).max(80),
    qty: z.number().int().min(1).max(99).optional(),
  })
  .strict();

/**
 * POST /api/marketplace/activate
 *
 * Owner-only. Inserts a business_addons row, creates a prorated invoice
 * (skipped when the add-on is "included" in the current tier), and writes
 * an audit_log entry — all atomically inside the
 * `public.marketplace_activate_addon` RPC.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = schema.parse(body);
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
  const { data, error } = await supabase.rpc("marketplace_activate_addon", {
    p_addon_slug: parsed.slug,
    p_qty: parsed.qty ?? 1,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("owner role")) {
      return NextResponse.json(
        { error: "forbidden", message: "Only the business owner can activate add-ons." },
        { status: 403 },
      );
    }
    if (msg.includes("not found")) {
      return NextResponse.json(
        { error: "not_found", message: error.message },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "activate_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ activation: data }, { status: 201 });
}
