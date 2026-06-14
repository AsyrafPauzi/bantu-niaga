import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ slug: z.string().min(2).max(80) }).strict();

/**
 * POST /api/marketplace/deactivate
 *
 * Owner-only. Sets the business_addons row to `pending_cancel` with
 * `cancel_at` set to the next charge date (or now if no charge cycle).
 * The row stays usable until cancel_at, matching what users see in the
 * UI ("Active until 14 Jul 2026").
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
  const { data, error } = await supabase.rpc("marketplace_deactivate_addon", {
    p_addon_slug: parsed.slug,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("owner role")) {
      return NextResponse.json(
        { error: "forbidden", message: "Only the business owner can deactivate add-ons." },
        { status: 403 },
      );
    }
    if (msg.includes("not active")) {
      return NextResponse.json(
        { error: "not_active", message: "Add-on is not active." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "deactivate_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ activation: data }, { status: 200 });
}
