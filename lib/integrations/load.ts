import "server-only";
import { cache } from "react";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

import {
  CATEGORY_META,
  INTEGRATION_CATALOG,
  findIntegration,
} from "./catalog";
import { decryptSecret, type SealedSecret } from "./crypto";
import type {
  FieldDescriptor,
  IntegrationCategory,
  IntegrationDescriptor,
  IntegrationRow,
} from "./types";

interface RawRow {
  slug: string;
  category: string;
  display_name: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  encrypted_credentials: {
    fields?: Record<string, SealedSecret>;
  } | null;
  test_status: "untested" | "ok" | "fail";
  last_tested_at: string | null;
  last_test_error: string | null;
  updated_by_admin_email: string | null;
  updated_at: string;
}

/**
 * Merge the compile-time catalog with the persisted row so the caller
 * gets one entry per descriptor regardless of whether anyone has
 * configured it yet. Secret values are NEVER returned — only a
 * `secretsConfigured` boolean per field.
 */
function projectRow(
  descriptor: IntegrationDescriptor,
  raw: RawRow | undefined,
): IntegrationRow {
  const secrets: Record<string, boolean> = {};
  for (const f of descriptor.fields) {
    if (f.type === "secret") {
      secrets[f.key] = !!raw?.encrypted_credentials?.fields?.[f.key];
    }
  }
  return {
    slug: descriptor.slug,
    category: descriptor.category,
    displayName: descriptor.name,
    enabled: raw?.enabled ?? false,
    config: (raw?.config as Record<string, unknown>) ?? {},
    secretsConfigured: secrets,
    testStatus: raw?.test_status ?? "untested",
    lastTestedAt: raw?.last_tested_at ?? null,
    lastTestError: raw?.last_test_error ?? null,
    updatedByAdminEmail: raw?.updated_by_admin_email ?? null,
    updatedAt: raw?.updated_at ?? "",
  };
}

/**
 * Load every integration in the catalog with its current state, grouped
 * by category. Used by the /super-admin/integrations index page.
 */
export const loadIntegrationCatalog = cache(
  async (): Promise<
    Array<{
      category: IntegrationCategory;
      label: string;
      description: string;
      emoji: string;
      items: IntegrationRow[];
    }>
  > => {
    const svc = createServiceRoleClient();
    const { data } = await svc
      .from("platform_integrations")
      .select(
        "slug, category, display_name, enabled, config, encrypted_credentials, test_status, last_tested_at, last_test_error, updated_by_admin_email, updated_at",
      );
    const rows = (data ?? []) as unknown as RawRow[];
    const bySlug = new Map(rows.map((r) => [r.slug, r]));

    const groups = new Map<IntegrationCategory, IntegrationRow[]>();
    for (const descriptor of INTEGRATION_CATALOG) {
      const projected = projectRow(descriptor, bySlug.get(descriptor.slug));
      const arr = groups.get(descriptor.category) ?? [];
      arr.push(projected);
      groups.set(descriptor.category, arr);
    }

    const order: IntegrationCategory[] = [
      "ai",
      "payments",
      "communication",
      "social",
      "einvoicing",
      "logistics",
      "maps",
      "accounting",
      "analytics",
      "storage",
    ];
    return order
      .filter((cat) => groups.has(cat))
      .map((cat) => ({
        category: cat,
        label: CATEGORY_META[cat].label,
        description: CATEGORY_META[cat].description,
        emoji: CATEGORY_META[cat].emoji,
        items: groups.get(cat) ?? [],
      }));
  },
);

/**
 * Load a single integration row by slug + its descriptor. Returns null
 * when the slug isn't in the catalog.
 */
export async function loadIntegration(slug: string): Promise<{
  descriptor: IntegrationDescriptor;
  row: IntegrationRow;
} | null> {
  const descriptor = findIntegration(slug);
  if (!descriptor) return null;

  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("platform_integrations")
    .select(
      "slug, category, display_name, enabled, config, encrypted_credentials, test_status, last_tested_at, last_test_error, updated_by_admin_email, updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();

  return {
    descriptor,
    row: projectRow(
      descriptor,
      data ? (data as unknown as RawRow) : undefined,
    ),
  };
}

/**
 * Resolve a configured integration's decrypted credentials + config for
 * use by an internal consumer (e.g. the OpenAI client).
 *
 * Returns null when:
 *   - the integration is not in the catalog,
 *   - no DB row exists,
 *   - the row exists but `enabled = false`.
 *
 * Per-field fallback to env var: when a required field has no DB value
 * and `envFallback[fieldKey]` is set, that value is used. This makes the
 * transition from env-only to db-managed painless.
 */
export async function resolveIntegration(
  slug: string,
  envFallback: Record<string, string | undefined> = {},
): Promise<{
  enabled: boolean;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
} | null> {
  const descriptor = findIntegration(slug);
  if (!descriptor) return null;

  const svc = createServiceRoleClient();
  const { data } = await svc
    .from("platform_integrations")
    .select("enabled, config, encrypted_credentials")
    .eq("slug", slug)
    .maybeSingle();

  const enabled = (data as { enabled?: boolean } | null)?.enabled ?? false;
  if (!enabled) return null;

  const secrets: Record<string, string> = {};
  const sealed = (data as {
    encrypted_credentials?: { fields?: Record<string, SealedSecret> };
  } | null)?.encrypted_credentials?.fields;

  for (const f of descriptor.fields) {
    if (f.type !== "secret") continue;
    const blob = sealed?.[f.key];
    if (blob) {
      try {
        secrets[f.key] = decryptSecret(blob);
      } catch {
        // Decryption failure — most likely INTEGRATION_ENCRYPTION_KEY
        // changed. Fall through to env fallback below.
      }
    }
    if (!secrets[f.key] && envFallback[f.key]) {
      secrets[f.key] = envFallback[f.key]!;
    }
  }

  return {
    enabled,
    config: ((data as { config?: Record<string, unknown> } | null)?.config) ?? {},
    secrets,
  };
}

export type FieldDescriptorReadonly = Readonly<FieldDescriptor>;
