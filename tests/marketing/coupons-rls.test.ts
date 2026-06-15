/**
 * RLS integration tests for `public.coupons` + `public.coupon_redemptions`.
 *
 * Mirrors the M1 customers RLS suite (tests/marketing/rls.test.ts) and
 * the segments RLS suite. Covers two cross-tenant scenarios:
 *
 *   1. Biz B cannot SELECT biz A's coupons via the SELECT policy.
 *   2. Biz B cannot INSERT a coupon_redemption against biz A's coupon
 *      via the with-check policy (the EXISTS clause requires the
 *      parent coupon to belong to the caller's business).
 *
 * Skipped when Supabase env vars are absent so CI without secrets
 * doesn't fail.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ENABLED = Boolean(URL && ANON && SERVICE);

interface Fixture {
  bizA: string;
  bizB: string;
  couponA: string;
  userA: { id: string; email: string; password: string };
  userB: { id: string; email: string; password: string };
  service: SupabaseClient;
}

let fixture: Fixture | null = null;
const createdCouponIds: string[] = [];
const createdRedemptionIds: string[] = [];

async function createTenant(
  service: SupabaseClient,
  label: string,
): Promise<{ businessId: string; userId: string; email: string; password: string }> {
  const businessId = randomUUID();
  const idcompany = `couprls-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const email = `${idcompany}@rls.bantuniaga.test`;
  const password = `RlsTest!${Math.random().toString(36).slice(2, 10)}`;

  const { error: bizError } = await service.from("businesses").insert({
    id: businessId,
    idcompany,
    name: `Coup RLS ${label}`,
    tier: "micro",
  });
  if (bizError) throw new Error(`seed business failed: ${bizError.message}`);

  const { data: userData, error: userError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (userError) throw new Error(`seed auth user failed: ${userError.message}`);
  const userId = userData.user?.id;
  if (!userId) throw new Error("seed auth user returned no id");

  const { error: profileError } = await service.from("users").insert({
    id: userId,
    business_id: businessId,
    role: "owner",
    email,
    display_name: `Coup RLS ${label}`,
  });
  if (profileError) {
    throw new Error(`seed public.users failed: ${profileError.message}`);
  }

  return { businessId, userId, email, password };
}

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL!, SERVICE!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const a = await createTenant(service, "a");
  const b = await createTenant(service, "b");

  // Seed a coupon owned by bizA so we have a target for cross-tenant
  // SELECT + INSERT-into-redemptions tests.
  const couponA = randomUUID();
  const { error: couponErr } = await service.from("coupons").insert({
    id: couponA,
    business_id: a.businessId,
    code: `RLSA${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    type: "PCT",
    value: 10,
    min_subtotal_myr: 0,
    per_customer_limit: 1,
    status: "active",
  });
  if (couponErr) throw new Error(`seed coupon failed: ${couponErr.message}`);
  createdCouponIds.push(couponA);

  fixture = {
    bizA: a.businessId,
    bizB: b.businessId,
    couponA,
    userA: { id: a.userId, email: a.email, password: a.password },
    userB: { id: b.userId, email: b.email, password: b.password },
    service,
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;

  if (createdRedemptionIds.length > 0) {
    await svc
      .from("coupon_redemptions")
      .delete()
      .in("id", createdRedemptionIds);
  }
  if (createdCouponIds.length > 0) {
    await svc.from("coupons").delete().in("id", createdCouponIds);
  }
  await svc.from("users").delete().in("id", [fixture.userA.id, fixture.userB.id]);
  await svc.from("businesses").delete().in("id", [fixture.bizA, fixture.bizB]);
  await svc.auth.admin.deleteUser(fixture.userA.id);
  await svc.auth.admin.deleteUser(fixture.userB.id);
}, 60_000);

describe.runIf(ENABLED)("RLS — coupons", () => {
  it("hides another business's coupons from SELECT", async () => {
    if (!fixture) return;

    const clientB = createClient(URL!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const { data: rows, error: selErr } = await clientB
      .from("coupons")
      .select("id")
      .eq("id", fixture.couponA);

    expect(selErr).toBeNull();
    expect(rows ?? []).toHaveLength(0);

    await clientB.auth.signOut();
  }, 90_000);

  it("rejects INSERT into another business's coupons via with-check", async () => {
    if (!fixture) return;

    const clientB = createClient(URL!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const attemptId = randomUUID();
    const { error } = await clientB.from("coupons").insert({
      id: attemptId,
      business_id: fixture.bizA, // wrong tenant
      code: "SNEAKY",
      type: "PCT",
      value: 10,
    });

    expect(error).not.toBeNull();
    expect(
      error?.code === "42501" || /policy/i.test(error?.message ?? ""),
    ).toBe(true);

    const { data: leaked } = await fixture.service
      .from("coupons")
      .select("id")
      .eq("id", attemptId);
    expect(leaked ?? []).toHaveLength(0);

    await clientB.auth.signOut();
  }, 90_000);
});

describe.runIf(ENABLED)("RLS — coupon_redemptions", () => {
  it("rejects INSERT against another business's coupon (with-check via parent)", async () => {
    if (!fixture) return;

    const clientB = createClient(URL!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const attemptId = randomUUID();
    const { error } = await clientB.from("coupon_redemptions").insert({
      id: attemptId,
      coupon_id: fixture.couponA, // belongs to bizA, but caller is bizB
      discount_amount_myr: 1,
    });

    expect(error).not.toBeNull();
    expect(
      error?.code === "42501" || /policy/i.test(error?.message ?? ""),
    ).toBe(true);

    const { data: leaked } = await fixture.service
      .from("coupon_redemptions")
      .select("id")
      .eq("id", attemptId);
    expect(leaked ?? []).toHaveLength(0);

    await clientB.auth.signOut();
  }, 90_000);
});

describe.skipIf(ENABLED)("RLS tests skipped — Supabase env vars missing", () => {
  it("placeholder so vitest reports zero-fail", () => {
    expect(true).toBe(true);
  });
});
