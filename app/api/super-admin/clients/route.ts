import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  parseProvisionClientInput,
  provisionClientAccount,
} from "@/lib/super-admin/provision-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/super-admin/clients — provision tenant + invite owner (campaign onboarding).
 */
export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseProvisionClientInput(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const svc = createServiceRoleClient();
  const { data: paRow } = await svc
    .from("platform_admins")
    .select("id")
    .eq("user_id", admin.userId)
    .maybeSingle();

  try {
    const result = await provisionClientAccount(
      svc,
      parsed,
      {
        userId: admin.userId,
        email: admin.email,
        platformAdminId: paRow?.id as string | undefined,
      },
      request.headers.get("origin"),
    );

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "provision_failed",
        message: error instanceof Error ? error.message : "Provision failed",
      },
      { status: 500 },
    );
  }
}
