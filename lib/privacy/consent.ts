import "server-only";

import { CONSENT_CATALOG } from "@/lib/privacy/catalog";
import type { ConsentKind } from "@/lib/privacy/types";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Resolve whether a consent is granted, using the stored row when present
 * or the catalog default when the user has never toggled it.
 */
export function resolveConsentGranted(
  kind: ConsentKind,
  stored: { granted: boolean } | null | undefined,
): boolean {
  if (stored) return stored.granted;
  const descriptor = CONSENT_CATALOG.find((d) => d.kind === kind);
  return descriptor?.defaultGranted ?? false;
}

/** Server-side consent lookup for enforcement gates. */
export async function isConsentGranted(
  userId: string,
  kind: ConsentKind,
): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("user_consents")
    .select("granted")
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();

  if (error) throw error;
  return resolveConsentGranted(kind, data);
}

export async function getConsentFlags(
  userId: string,
): Promise<Record<ConsentKind, boolean>> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("user_consents")
    .select("kind, granted")
    .eq("user_id", userId);

  if (error) throw error;

  const byKind = new Map<ConsentKind, boolean>();
  for (const row of data ?? []) {
    byKind.set(row.kind as ConsentKind, Boolean(row.granted));
  }

  return CONSENT_CATALOG.reduce(
    (acc, descriptor) => {
      acc[descriptor.kind] = resolveConsentGranted(
        descriptor.kind,
        byKind.has(descriptor.kind)
          ? { granted: byKind.get(descriptor.kind)! }
          : null,
      );
      return acc;
    },
    {} as Record<ConsentKind, boolean>,
  );
}
