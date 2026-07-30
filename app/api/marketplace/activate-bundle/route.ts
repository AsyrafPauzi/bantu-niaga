import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  BUSINESS_BUNDLES,
  computeBundlePricing,
  type BusinessBundle,
} from "@/lib/onboarding/business-bundles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    bundle_id: z.string().min(2).max(80),
    selected_optional_slugs: z.array(z.string()).optional().default([]),
    change_tier: z.boolean().optional().default(true),
  })
  .strict();

function findBundle(id: string): BusinessBundle | null {
  return BUSINESS_BUNDLES.find((b) => b.id === id) ?? null;
}

/** POST /api/marketplace/activate-bundle — one-click bundle activation. */
export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  if (user.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bundle = findBundle(parsed.bundle_id);
  if (!bundle) {
    return NextResponse.json({ error: "bundle_not_found" }, { status: 404 });
  }

  const { TIERS } = await import("@/lib/settings/plans");
  const tierMeta = TIERS.find((t) => t.key === bundle.recommendedTier);
  const planPriceCents = (tierMeta?.priceMyr ?? 0) * 100;

  const supabase = await createSupabaseServerClient();

  const [businessRes, catalogRes, activeRes] = await Promise.all([
    supabase.from("businesses").select("tier").eq("id", user.businessId).maybeSingle(),
    supabase
      .from("marketplace_addons")
      .select("slug, name, price_cents, cadence, included_in_tier, is_coming_soon"),
    supabase
      .from("business_addons")
      .select("addon_id, marketplace_addons!inner(slug)")
      .eq("business_id", user.businessId)
      .neq("status", "cancelled"),
  ]);

  const business = businessRes.data;
  if (!business?.tier) {
    return NextResponse.json({ error: "business_not_found" }, { status: 404 });
  }

  const currentTier = business.tier as import("@/lib/settings/plans").TierKey;
  const catalogBySlug = new Map(
    (catalogRes.data ?? []).map((a) => [a.slug, a]),
  );
  const activeSlugs = new Set(
    (activeRes.data ?? []).map((r) => {
      const addon = r.marketplace_addons as { slug: string } | { slug: string }[];
      return Array.isArray(addon) ? addon[0]?.slug : addon.slug;
    }).filter(Boolean) as string[],
  );

  const pricing = computeBundlePricing({
    bundle,
    planPriceCents,
    catalogBySlug,
    currentTier,
    activeSlugs,
    selectedOptionalSlugs: new Set(parsed.selected_optional_slugs),
  });

  if (parsed.change_tier && currentTier !== bundle.recommendedTier) {
    const { error: tierErr } = await supabase.rpc("settings_change_tier", {
      p_business_id: user.businessId,
      p_tier: bundle.recommendedTier,
      p_user_id: user.id,
    });
    if (tierErr) {
      return NextResponse.json(
        { error: "tier_change_failed", message: tierErr.message },
        { status: 500 },
      );
    }
  }

  const activated: string[] = [];
  const skipped: Array<{ slug: string; reason: string }> = [];
  const errors: Array<{ slug: string; message: string }> = [];

  for (const line of pricing.lines) {
    if (line.comingSoon) {
      skipped.push({ slug: line.slug, reason: "coming_soon" });
      continue;
    }
    if (line.active || line.includedInTier) {
      skipped.push({ slug: line.slug, reason: "already_active" });
      continue;
    }

    const { error } = await supabase.rpc("marketplace_activate_addon", {
      p_addon_slug: line.slug,
      p_qty: 1,
    });

    if (error) errors.push({ slug: line.slug, message: error.message });
    else activated.push(line.slug);
  }

  await supabase.from("audit_log").insert({
    business_id: user.businessId,
    actor_user_id: user.id,
    action: "marketplace.activate_bundle",
    entity_type: "bundle",
    entity_id: bundle.id,
    diff: { activated, skipped, errors },
  });

  if (errors.length > 0 && activated.length === 0) {
    return NextResponse.json(
      { error: "activate_failed", activated, skipped, errors },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { bundle_id: bundle.id, activated, skipped, errors, pricing },
    { status: 201 },
  );
}
