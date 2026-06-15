/**
 * RLS integration tests for `public.broadcasts` + `public.broadcast_recipients`.
 *
 * Mirrors the segments-rls + customers RLS suites: seed two isolated
 * (business, owner) pairs via service-role, then assert cross-tenant
 * reads return zero rows and cross-tenant inserts are blocked by the
 * with-check policy.
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
  segmentA: string;
  customerA: string;
  userA: { id: string; email: string; password: string };
  userB: { id: string; email: string; password: string };
  service: SupabaseClient;
}

let fixture: Fixture | null = null;
const createdBroadcastIds: string[] = [];

async function createTenant(
  service: SupabaseClient,
  label: string,
): Promise<{ businessId: string; userId: string; email: string; password: string }> {
  const businessId = randomUUID();
  const idcompany = `bcrls-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const email = `${idcompany}@rls.bantuniaga.test`;
  const password = `RlsTest!${Math.random().toString(36).slice(2, 10)}`;

  const { error: bizError } = await service.from("businesses").insert({
    id: businessId,
    idcompany,
    name: `BC RLS ${label}`,
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
    display_name: `BC RLS ${label}`,
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

  // The migration seed inserts auto segments for businesses that
  // existed at apply time. Brand-new test businesses created here
  // post-migration need their own seed. Mirrors what
  // seedAutoSegmentsForBusiness does in the production path.
  const vipSegmentId = randomUUID();
  const { error: segSeedErr } = await service
    .from("customer_segments")
    .insert({
      id: vipSegmentId,
      business_id: a.businessId,
      name: "VIP",
      kind: "auto",
      auto_key: "vip",
    });
  if (segSeedErr) {
    throw new Error(`seed biz A vip segment failed: ${segSeedErr.message}`);
  }

  // Seed a customer in biz A so broadcast_recipients has a valid FK to land.
  const customerA = randomUUID();
  const { error: custErr } = await service.from("customers").insert({
    id: customerA,
    business_id: a.businessId,
    name: "BizA test customer",
    phone_e164: `+6019${Math.floor(Math.random() * 9_000_000 + 1_000_000)}`,
    source: "manual",
  });
  if (custErr) throw new Error(`seed customer failed: ${custErr.message}`);

  fixture = {
    bizA: a.businessId,
    bizB: b.businessId,
    segmentA: vipSegmentId,
    customerA,
    userA: { id: a.userId, email: a.email, password: a.password },
    userB: { id: b.userId, email: b.email, password: b.password },
    service,
  };
}, 90_000);

afterAll(async () => {
  if (!fixture) return;
  const svc = fixture.service;

  if (createdBroadcastIds.length > 0) {
    // recipients cascade with broadcast.
    await svc
      .from("broadcasts")
      .delete()
      .in("id", createdBroadcastIds);
  }
  await svc.from("customers").delete().eq("id", fixture.customerA);
  // customer_segments cascade with the business row.
  await svc.from("users").delete().in("id", [fixture.userA.id, fixture.userB.id]);
  await svc.from("businesses").delete().in("id", [fixture.bizA, fixture.bizB]);
  await svc.auth.admin.deleteUser(fixture.userA.id);
  await svc.auth.admin.deleteUser(fixture.userB.id);
}, 60_000);

describe.runIf(ENABLED)("RLS — broadcasts", () => {
  it("hides another business's broadcasts from SELECT", async () => {
    if (!fixture) return;
    const insertedId = randomUUID();
    const { error: insErr } = await fixture.service
      .from("broadcasts")
      .insert({
        id: insertedId,
        business_id: fixture.bizA,
        name: "BizA only",
        channel: "whatsapp_ctc",
        segment_id: fixture.segmentA,
        message_template: "Hi {first_name}",
      });
    if (insErr) throw insErr;
    createdBroadcastIds.push(insertedId);

    const clientB = createClient(URL!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const { data: rows, error: selErr } = await clientB
      .from("broadcasts")
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
    const { error } = await clientB.from("broadcasts").insert({
      id: attemptId,
      business_id: fixture.bizA,
      name: "sneaky",
      channel: "whatsapp_ctc",
      segment_id: fixture.segmentA,
      message_template: "x",
    });
    expect(error).not.toBeNull();
    expect(error?.code === "42501" || /policy/i.test(error?.message ?? "")).toBe(
      true,
    );

    // Defensive: nothing landed.
    const { data: leaked } = await fixture.service
      .from("broadcasts")
      .select("id")
      .eq("id", attemptId);
    expect(leaked ?? []).toHaveLength(0);

    await clientB.auth.signOut();
  }, 90_000);

  it("hides another business's broadcast_recipients from SELECT", async () => {
    if (!fixture) return;
    const bcastId = randomUUID();
    const rcptId = randomUUID();

    const { error: bcastErr } = await fixture.service.from("broadcasts").insert({
      id: bcastId,
      business_id: fixture.bizA,
      name: "BizA with recipient",
      channel: "whatsapp_ctc",
      segment_id: fixture.segmentA,
      message_template: "Hi",
    });
    if (bcastErr) throw bcastErr;
    createdBroadcastIds.push(bcastId);

    const { error: rcptErr } = await fixture.service
      .from("broadcast_recipients")
      .insert({
        id: rcptId,
        broadcast_id: bcastId,
        customer_id: fixture.customerA,
        channel_address: "+60111111111",
        rendered_message: "Hi",
        status: "sent",
      });
    if (rcptErr) throw rcptErr;

    const clientB = createClient(URL!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const { data: rows, error: selErr } = await clientB
      .from("broadcast_recipients")
      .select("id")
      .eq("id", rcptId);

    expect(selErr).toBeNull();
    expect(rows ?? []).toHaveLength(0);

    await clientB.auth.signOut();
  }, 90_000);
});

describe.skipIf(ENABLED)("RLS tests skipped — Supabase env vars missing", () => {
  it("placeholder so vitest reports zero-fail", () => {
    expect(true).toBe(true);
  });
});
