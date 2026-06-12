/**
 * RLS integration tests for the Marketing M1 schema.
 *
 * These tests hit the LIVE remote Supabase project configured in
 * `.env.local`. They use:
 *   - the service-role client to seed two isolated business + user rows
 *   - the anon client + sign-in to obtain a real JWT and verify RLS
 *     blocks cross-tenant reads and surfaces soft-delete tombstones
 *
 * All rows created by these tests are cleaned up in `afterAll`. The
 * tests skip (instead of failing) when env vars are absent, so they
 * don't block CI in environments without a Supabase project.
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
const createdCustomerIds: string[] = [];

function tag(): string {
  return `rls-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createTenant(
  service: SupabaseClient,
  label: string,
): Promise<{ businessId: string; userId: string; email: string; password: string }> {
  const businessId = randomUUID();
  const idcompany = `rls-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const email = `${idcompany}@rls.bantuniaga.test`;
  const password = `RlsTest!${Math.random().toString(36).slice(2, 10)}`;

  const { error: bizError } = await service.from("businesses").insert({
    id: businessId,
    idcompany,
    name: `RLS Test ${label}`,
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
    display_name: `RLS ${label}`,
  });
  if (profileError) {
    throw new Error(`seed public.users failed: ${profileError.message}`);
  }

  return { businessId, userId, email, password };
}

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL!, SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
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
}, 60_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;

  if (createdCustomerIds.length > 0) {
    await svc
      .from("customers")
      .delete()
      .in("id", createdCustomerIds);
  }
  // Cascade order: public.users → businesses → auth.users.
  await svc.from("users").delete().in("id", [fixture.userA.id, fixture.userB.id]);
  await svc.from("businesses").delete().in("id", [fixture.bizA, fixture.bizB]);
  await svc.auth.admin.deleteUser(fixture.userA.id);
  await svc.auth.admin.deleteUser(fixture.userB.id);
}, 60_000);

describe.runIf(ENABLED)("RLS — Marketing M1 customers table", () => {
  it("hides customers belonging to another business", async () => {
    if (!fixture) return;

    // Seed a customer in biz A via service role.
    const insertedId = randomUUID();
    const { error: insErr } = await fixture.service.from("customers").insert({
      id: insertedId,
      business_id: fixture.bizA,
      name: `${tag()}-bizA-customer`,
      phone_e164: "+60123456001",
      source: "manual",
    });
    if (insErr) throw insErr;
    createdCustomerIds.push(insertedId);

    // Sign in as biz B and try to read.
    const clientB = createClient(URL!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const { data: rows, error: selErr } = await clientB
      .from("customers")
      .select("id")
      .eq("id", insertedId);

    expect(selErr).toBeNull();
    expect(rows ?? []).toHaveLength(0);

    await clientB.auth.signOut();
  }, 60_000);

  it("hides soft-deleted customers from the default SELECT path", async () => {
    if (!fixture) return;

    const insertedId = randomUUID();
    const { error: insErr } = await fixture.service.from("customers").insert({
      id: insertedId,
      business_id: fixture.bizA,
      name: `${tag()}-bizA-tombstone`,
      phone_e164: "+60123456002",
      source: "manual",
    });
    if (insErr) throw insErr;
    createdCustomerIds.push(insertedId);

    const clientA = createClient(URL!, ANON!);
    const { error: signInErr } = await clientA.auth.signInWithPassword({
      email: fixture.userA.email,
      password: fixture.userA.password,
    });
    if (signInErr) throw signInErr;

    // Visible before tombstone.
    const { data: beforeRows } = await clientA
      .from("customers")
      .select("id")
      .eq("id", insertedId);
    expect(beforeRows ?? []).toHaveLength(1);

    // Set the tombstone via service role so the test doesn't depend on the
    // (M2) DELETE route handler's update + return-minimal contract. This
    // test's assertion is "default SELECT hides soft-deleted rows".
    const { error: updErr } = await fixture.service
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", insertedId);
    expect(updErr).toBeNull();

    // After soft-delete the default SELECT path hides it for the owner.
    const { data: afterRows } = await clientA
      .from("customers")
      .select("id")
      .eq("id", insertedId);
    expect(afterRows ?? []).toHaveLength(0);

    await clientA.auth.signOut();
  }, 60_000);
});

describe.skipIf(ENABLED)("RLS tests skipped — Supabase env vars missing", () => {
  it("placeholder so vitest reports zero-fail", () => {
    expect(true).toBe(true);
  });
});
