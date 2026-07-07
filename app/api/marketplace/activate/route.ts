import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { hasPillar, type Pillar } from "@/lib/auth/entitlements";
import type { TierKey } from "@/lib/settings/plans";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z
  .object({
    slug: z.string().min(2).max(80),
    qty: z.number().int().min(1).max(99).optional(),
  })
  .strict();

const MODULE_ADDON_PILLARS = [
  "admin",
  "finance",
  "operations",
  "sales",
  "marketing",
  "hr",
] as const satisfies readonly Pillar[];

function isTierKey(value: unknown): value is TierKey {
  return (
    value === "starter" ||
    value === "micro" ||
    value === "sme" ||
    value === "enterprise"
  );
}

function isModulePillar(value: string): value is Pillar {
  return (MODULE_ADDON_PILLARS as readonly string[]).includes(value);
}

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

  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: business, error: businessError }, { data: addon, error: addonError }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("tier")
        .eq("id", user.businessId)
        .maybeSingle(),
      supabase
        .from("marketplace_addons")
        .select("slug, name, pillar, is_coming_soon")
        .eq("slug", parsed.slug)
        .maybeSingle(),
    ]);

  if (businessError || !business || !isTierKey(business.tier)) {
    return NextResponse.json(
      { error: "business_not_found", message: "Could not verify the business plan." },
      { status: 404 },
    );
  }

  if (addonError || !addon) {
    return NextResponse.json(
      { error: "not_found", message: `Add-on not found: ${parsed.slug}` },
      { status: 404 },
    );
  }

  if ((addon as { is_coming_soon?: boolean }).is_coming_soon) {
    return NextResponse.json(
      {
        error: "coming_soon",
        message: `${addon.name} is coming soon. We will notify you when it is available.`,
      },
      { status: 403 },
    );
  }

  if (business.tier === "starter") {
    return NextResponse.json(
      {
        error: "plan_not_eligible",
        message: "Free plan cannot activate add-ons. Upgrade to Starter or higher first.",
      },
      { status: 403 },
    );
  }

  if (isModulePillar(addon.pillar) && !hasPillar(business.tier, addon.pillar)) {
    return NextResponse.json(
      {
        error: "module_locked",
        message: `${addon.name} requires the ${addon.pillar} module. Upgrade your plan before activating this add-on.`,
      },
      { status: 403 },
    );
  }

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
