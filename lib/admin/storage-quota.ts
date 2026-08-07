import type { SupabaseClient } from "@supabase/supabase-js";
import { tierBy, type TierKey } from "@/lib/settings/plans";

const STORAGE_ADDON_SLUG = "storage-10gb";
const STORAGE_ADDON_MB = 10 * 1024;

export interface StorageQuotaInfo {
  usedBytes: number;
  quotaMb: number | null;
  usagePct: number | null;
  isUnlimited: boolean;
}

export async function loadStorageQuota(
  supabase: SupabaseClient,
  businessId: string,
  tierKey: TierKey | string,
): Promise<StorageQuotaInfo> {
  const [bytesRes, addonRes] = await Promise.all([
    supabase
      .from("admin_files")
      .select("file_size_bytes")
      .eq("business_id", businessId)
      .is("deleted_at", null),
    supabase
      .from("business_addons")
      .select("id, marketplace_addons!inner(slug)")
      .eq("business_id", businessId)
      .eq("status", "active")
      .eq("marketplace_addons.slug", STORAGE_ADDON_SLUG),
  ]);

  const usedBytes = (bytesRes.data ?? []).reduce(
    (sum, row) => sum + Number((row as { file_size_bytes: number }).file_size_bytes ?? 0),
    0,
  );

  const tier = tierBy(tierKey);
  const baseQuotaMb = tier?.quotas.storageMb;

  if (baseQuotaMb == null || !Number.isFinite(baseQuotaMb)) {
    return { usedBytes, quotaMb: null, usagePct: null, isUnlimited: true };
  }

  const storageAddonCount = addonRes.data?.length ?? 0;
  const quotaMb = baseQuotaMb + storageAddonCount * STORAGE_ADDON_MB;
  const quotaBytes = quotaMb * 1024 * 1024;
  const usagePct =
    quotaBytes > 0
      ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100))
      : 0;

  return { usedBytes, quotaMb, usagePct, isUnlimited: false };
}

export function assertWithinStorageQuota(
  quota: StorageQuotaInfo,
  additionalBytes: number,
): void {
  if (quota.isUnlimited || quota.quotaMb == null) return;
  const quotaBytes = quota.quotaMb * 1024 * 1024;
  if (quota.usedBytes + additionalBytes > quotaBytes) {
    throw new Error("storage_quota_exceeded");
  }
}
