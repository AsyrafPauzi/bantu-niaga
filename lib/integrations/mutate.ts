import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

import { findIntegration } from "./catalog";
import { encryptSecret, encryptionConfigured, type SealedSecret } from "./crypto";

interface UpsertInput {
  slug: string;
  /** Toggle on / off without touching the saved fields. */
  enabled?: boolean;
  /** Non-secret fields. Merged with existing config (only provided keys overwritten). */
  config?: Record<string, unknown>;
  /** Secret fields. Empty string ⇒ leave existing; null ⇒ clear. */
  secrets?: Record<string, string | null>;
  adminUserId: string;
  adminEmail: string;
}

export async function upsertIntegration(input: UpsertInput): Promise<void> {
  const descriptor = findIntegration(input.slug);
  if (!descriptor) throw new Error(`Unknown integration slug: ${input.slug}`);
  if (input.secrets && Object.keys(input.secrets).length > 0) {
    if (!encryptionConfigured()) {
      throw new Error(
        "Cannot save secrets — INTEGRATION_ENCRYPTION_KEY is not set.",
      );
    }
  }

  const svc = createServiceRoleClient();

  // Fetch current state so we can merge.
  const { data: existing } = await svc
    .from("platform_integrations")
    .select("config, encrypted_credentials")
    .eq("slug", input.slug)
    .maybeSingle();

  const existingConfig =
    ((existing as { config?: Record<string, unknown> } | null)?.config) ?? {};
  const existingFields =
    ((existing as {
      encrypted_credentials?: { fields?: Record<string, SealedSecret> };
    } | null)?.encrypted_credentials?.fields) ?? {};

  const mergedConfig: Record<string, unknown> = { ...existingConfig };
  if (input.config) {
    for (const [k, v] of Object.entries(input.config)) {
      mergedConfig[k] = v;
    }
  }

  const mergedFields: Record<string, SealedSecret> = { ...existingFields };
  if (input.secrets) {
    for (const [k, v] of Object.entries(input.secrets)) {
      if (v === null) {
        delete mergedFields[k];
      } else if (typeof v === "string" && v.length > 0) {
        mergedFields[k] = encryptSecret(v);
      }
      // empty string ⇒ no-op (keep existing).
    }
  }

  const payload = {
    slug: descriptor.slug,
    category: descriptor.category,
    display_name: descriptor.name,
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    config: mergedConfig,
    encrypted_credentials: Object.keys(mergedFields).length
      ? { v: 1, alg: "AES-256-GCM", fields: mergedFields }
      : null,
    updated_by_admin_id: input.adminUserId,
    updated_by_admin_email: input.adminEmail,
    // Any change resets the test status so the admin knows to re-run.
    test_status: "untested" as const,
    last_test_error: null as string | null,
  };

  const { error } = await svc
    .from("platform_integrations")
    .upsert(payload, { onConflict: "slug" });
  if (error) throw error;

  await svc.from("super_admin_audit").insert({
    admin_user_id: input.adminUserId,
    admin_email: input.adminEmail,
    action: "integration.upsert",
    target_type: "integration",
    target_id: descriptor.slug,
    diff: {
      enabled: input.enabled,
      config_keys: input.config ? Object.keys(input.config) : [],
      secret_keys: input.secrets ? Object.keys(input.secrets) : [],
    },
  });
}

export async function recordTestResult(opts: {
  slug: string;
  ok: boolean;
  error?: string;
  adminUserId: string;
  adminEmail: string;
}): Promise<void> {
  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("platform_integrations")
    .update({
      test_status: opts.ok ? "ok" : "fail",
      last_tested_at: new Date().toISOString(),
      last_test_error: opts.ok ? null : opts.error ?? "Test failed",
    })
    .eq("slug", opts.slug);
  if (error) throw error;

  await svc.from("super_admin_audit").insert({
    admin_user_id: opts.adminUserId,
    admin_email: opts.adminEmail,
    action: opts.ok ? "integration.test.ok" : "integration.test.fail",
    target_type: "integration",
    target_id: opts.slug,
    diff: opts.ok ? null : { error: opts.error ?? null },
  });
}
