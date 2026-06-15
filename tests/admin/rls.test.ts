/**
 * RLS integration tests for the Admin Storage M1 schema.
 *
 * Same shape as `tests/marketing/rls.test.ts`: spin up two isolated
 * business + owner pairs via the service-role client, then verify that
 * a real signed-in session for business B cannot read or insert into
 * business A's admin_files rows.
 *
 * These tests skip (instead of failing) when env vars are absent, so
 * they don't block CI in environments without a Supabase project.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENABLED = Boolean(URL_ && ANON && SERVICE);

interface Fixture {
  bizA: string;
  bizB: string;
  userA: { id: string; email: string; password: string };
  userB: { id: string; email: string; password: string };
  service: SupabaseClient;
}

let fixture: Fixture | null = null;
const createdFileIds: string[] = [];

async function seedTenant(
  service: SupabaseClient,
  label: string,
): Promise<{
  businessId: string;
  userId: string;
  email: string;
  password: string;
}> {
  const businessId = randomUUID();
  const idcompany = `admin-rls-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const email = `${idcompany}@rls.admin.bantuniaga.test`;
  const password = `RlsAdmin!${Math.random().toString(36).slice(2, 10)}`;

  const { error: bizErr } = await service.from("businesses").insert({
    id: businessId,
    idcompany,
    name: `Admin RLS ${label}`,
    tier: "micro",
  });
  if (bizErr) throw new Error(`seed business ${label}: ${bizErr.message}`);

  const { data: u, error: ue } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (ue) throw new Error(`seed auth user ${label}: ${ue.message}`);
  const userId = u.user?.id;
  if (!userId) throw new Error("seed auth user returned no id");

  const { error: pe } = await service.from("users").insert({
    id: userId,
    business_id: businessId,
    role: "owner",
    email,
    display_name: `Admin RLS ${label}`,
  });
  if (pe) throw new Error(`seed public.users ${label}: ${pe.message}`);

  return { businessId, userId, email, password };
}

beforeAll(async () => {
  if (!ENABLED) return;
  const service = createClient(URL_!, SERVICE!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const a = await seedTenant(service, "a");
  const b = await seedTenant(service, "b");
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
  if (createdFileIds.length > 0) {
    await svc.from("admin_files").delete().in("id", createdFileIds);
  }
  await svc
    .from("users")
    .delete()
    .in("id", [fixture.userA.id, fixture.userB.id]);
  await svc
    .from("businesses")
    .delete()
    .in("id", [fixture.bizA, fixture.bizB]);
  await svc.auth.admin.deleteUser(fixture.userA.id);
  await svc.auth.admin.deleteUser(fixture.userB.id);
}, 60_000);

describe.runIf(ENABLED)("RLS — admin_files table", () => {
  it("hides admin_files belonging to another business", async () => {
    if (!fixture) return;

    const fileId = randomUUID();
    const { error: insErr } = await fixture.service.from("admin_files").insert({
      id: fileId,
      business_id: fixture.bizA,
      uploaded_by: fixture.userA.id,
      storage_path: `${fixture.bizA}/${randomUUID()}/rls-test.txt`,
      file_name: "rls-test.txt",
      mime_type: "text/plain",
      file_size_bytes: 11,
      category: null,
      description: null,
    });
    if (insErr) throw insErr;
    createdFileIds.push(fileId);

    // Sign in as business B and try to read business A's row.
    const clientB = createClient(URL_!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const { data: rows, error: selErr } = await clientB
      .from("admin_files")
      .select("id")
      .eq("id", fileId);

    expect(selErr).toBeNull();
    expect(rows ?? []).toHaveLength(0);

    await clientB.auth.signOut();
  }, 60_000);

  it("refuses INSERT with another business's business_id", async () => {
    if (!fixture) return;

    const clientB = createClient(URL_!, ANON!);
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: fixture.userB.email,
      password: fixture.userB.password,
    });
    if (signInErr) throw signInErr;

    const { error: insErr } = await clientB.from("admin_files").insert({
      business_id: fixture.bizA, // cross-tenant!
      uploaded_by: fixture.userB.id,
      storage_path: `${fixture.bizA}/${randomUUID()}/foo.txt`,
      file_name: "foo.txt",
      mime_type: "text/plain",
      file_size_bytes: 5,
    });

    expect(insErr).not.toBeNull();

    await clientB.auth.signOut();
  }, 60_000);

  it("hides soft-deleted rows from the default SELECT path", async () => {
    if (!fixture) return;

    const fileId = randomUUID();
    const { error: insErr } = await fixture.service.from("admin_files").insert({
      id: fileId,
      business_id: fixture.bizA,
      uploaded_by: fixture.userA.id,
      storage_path: `${fixture.bizA}/${randomUUID()}/tombstone.txt`,
      file_name: "tombstone.txt",
      mime_type: "text/plain",
      file_size_bytes: 11,
    });
    if (insErr) throw insErr;
    createdFileIds.push(fileId);

    const clientA = createClient(URL_!, ANON!);
    const { error: signInErr } = await clientA.auth.signInWithPassword({
      email: fixture.userA.email,
      password: fixture.userA.password,
    });
    if (signInErr) throw signInErr;

    const { data: before } = await clientA
      .from("admin_files")
      .select("id")
      .eq("id", fileId);
    expect(before ?? []).toHaveLength(1);

    // Tombstone via service role.
    const { error: updErr } = await fixture.service
      .from("admin_files")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", fileId);
    expect(updErr).toBeNull();

    const { data: after } = await clientA
      .from("admin_files")
      .select("id")
      .eq("id", fileId);
    expect(after ?? []).toHaveLength(0);

    await clientA.auth.signOut();
  }, 60_000);
});

describe.skipIf(ENABLED)(
  "Admin RLS tests skipped — Supabase env vars missing",
  () => {
    it("placeholder so vitest reports zero-fail", () => {
      expect(true).toBe(true);
    });
  },
);
