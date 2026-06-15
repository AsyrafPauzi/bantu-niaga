/**
 * RLS integration tests for `public.customer_segments`.
 *
 * Mirrors the M1 customers RLS suite (tests/marketing/rls.test.ts):
 *   - Seeds two isolated business + owner pairs via service-role.
 *   - Signs in as biz B and verifies it can't see biz A's segments.
 *   - Signs in as biz B and verifies it can't INSERT a custom segment
 *     against biz A's id (with-check should reject).
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
  userA: { id: string; email: string; password: string };
  userB: { id: string; email: string; password: string };
  service: SupabaseClient;
}

let fixture: Fixture | null = null;
const createdSegmentIds: string[] = [];

async function createTenant(
  service: SupabaseClient,
  label: string,
): Promise<{ businessId: string; userId: string; email: string; password: string }> {
  const businessId = randomUUID();
  const idcompany = `segrls-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const email = `${idcompany}@rls.bantuniaga.test`;
  const password = `RlsTest!${Math.random().toString(36).slice(2, 10)}`;

  const { error: bizError } = await service.from("businesses").insert({
    id: businessId,
    idcompany,
    name: `Seg RLS ${label}`,
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
    display_name: `Seg RLS ${label}`,
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

  fixture = {
    bizA: a.businessId,
    bizB: b.businessId,
    userA: { id: a.userId, email: a.email, password: a.password },
    userB: { id: b.userId, email: b.email, password: b.password },
    service,
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;

  if (createdSegmentIds.length > 0) {
    await svc
      .from("customer_segments")
      .delete()
      .in("id", createdSegmentIds);
  }
  // Auto segments seeded by the migration cascade with the business row.
  await svc.from("users").delete().in("id", [fixture.userA.id, fixture.userB.id]);
  await svc.from("businesses").delete().in("id", [fixture.bizA, fixture.bizB]);
  await svc.auth.admin.deleteUser(fixture.userA.id);
  await svc.auth.admin.deleteUser(fixture.userB.id);
}, 60_000);

describe.runIf(ENABLED)("RLS — customer_segments", () => {
  it("hides another business's custom segments from SELECT", async () => {
    if (!fixture) return;

    const insertedId = randomUUID();
    const { error: insErr } = await fixture.service
      .from("customer_segments")
      .insert({
        id: insertedId,
        business_id: fixture.bizA,
        name: "Big spenders — bizA",
        kind: "custom",
        auto_key: null,
        rules: { min_spend_myr: 500 },
      });
    if (insErr) throw insErr;
    createdSegmentIds.push(insertedId);

    const clientB = createClient(URL!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const { data: rows, error: selErr } = await clientB
      .from("customer_segments")
      .select("id")
      .eq("id", insertedId);

    expect(selErr).toBeNull();
    expect(rows ?? []).toHaveLength(0);

    await clientB.auth.signOut();
  }, 90_000);

  it("rejects INSERT into another business via with-check", async () => {
    if (!fixture) return;

    const clientB = createClient(URL!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const attemptId = randomUUID();
    const { error } = await clientB.from("customer_segments").insert({
      id: attemptId,
      business_id: fixture.bizA,
      name: "Sneaky cross-tenant insert",
      kind: "custom",
      auto_key: null,
      rules: { min_spend_myr: 1 },
    });

    expect(error).not.toBeNull();
    // PostgREST surfaces RLS with-check denials as 42501.
    expect(error?.code === "42501" || /policy/i.test(error?.message ?? "")).toBe(
      true,
    );

    // Defensive: make sure nothing landed via service-role lookup.
    const { data: leaked } = await fixture.service
      .from("customer_segments")
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
