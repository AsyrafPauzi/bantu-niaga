import "server-only";
import { cache } from "react";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

import { CONSENT_CATALOG } from "./catalog";
import type {
  ConsentKind,
  DataExportSummary,
  DataSubjectRequest,
  DsrKind,
  DsrStatus,
  UserConsent,
} from "./types";

/**
 * Load the latest consent state for the current user, merged with the
 * static catalog so we always render every consent kind even if the user
 * has never toggled it.
 */
export const loadConsents = cache(
  async (userId: string, businessId: string): Promise<UserConsent[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_consents")
      .select(
        "id, business_id, user_id, kind, granted, policy_version, granted_at, withdrawn_at, updated_at",
      )
      .eq("user_id", userId);

    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const byKind = new Map<ConsentKind, UserConsent>();
    for (const r of rows) {
      const kind = r.kind as ConsentKind;
      byKind.set(kind, {
        id: String(r.id),
        businessId: String(r.business_id),
        userId: String(r.user_id),
        kind,
        granted: Boolean(r.granted),
        policyVersion: (r.policy_version as string | null) ?? null,
        grantedAt: (r.granted_at as string | null) ?? null,
        withdrawnAt: (r.withdrawn_at as string | null) ?? null,
        updatedAt: String(r.updated_at ?? ""),
      });
    }

    return CONSENT_CATALOG.map(
      (d): UserConsent =>
        byKind.get(d.kind) ?? {
          id: "",
          businessId,
          userId,
          kind: d.kind,
          granted: d.defaultGranted,
          policyVersion: null,
          grantedAt: null,
          withdrawnAt: null,
          updatedAt: "",
        },
    );
  },
);

/**
 * List the current user's data-subject requests, newest first.
 */
export const loadUserDsrs = cache(
  async (userId: string, limit = 10): Promise<DataSubjectRequest[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("data_subject_requests")
      .select(
        "id, business_id, user_id, kind, status, reason, payload, scheduled_for, completed_at, cancelled_at, cancellation_reason, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(
      coerceDsr,
    );
  },
);

export const countUserDsrs = cache(async (userId: string): Promise<number> => {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("data_subject_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
});

/** Active account/business deletion awaiting grace, if any. */
export const loadPendingDeletionRequest = cache(
  async (userId: string): Promise<DataSubjectRequest | null> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("data_subject_requests")
      .select(
        "id, business_id, user_id, kind, status, reason, payload, scheduled_for, completed_at, cancelled_at, cancellation_reason, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("status", "awaiting_grace")
      .in("kind", ["delete_user", "delete_business"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return coerceDsr(data as unknown as Record<string, unknown>);
  },
);

/**
 * Cross-tenant DSR queue used by /super-admin/privacy. Uses the
 * service-role client so we can see all rows regardless of RLS.
 */
export async function loadDsrSummary(): Promise<{
  pending: number;
  awaitingGrace: number;
  completed: number;
  failed: number;
}> {
  const supabase = createServiceRoleClient() as unknown as SupabaseClient;
  const [
    { count: pending },
    { count: inProgress },
    { count: awaitingGrace },
    { count: completed },
    { count: failed },
  ] = await Promise.all([
    supabase
      .from("data_subject_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("data_subject_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress"),
    supabase
      .from("data_subject_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "awaiting_grace"),
    supabase
      .from("data_subject_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("data_subject_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);

  return {
    pending: (pending ?? 0) + (inProgress ?? 0),
    awaitingGrace: awaitingGrace ?? 0,
    completed: completed ?? 0,
    failed: failed ?? 0,
  };
}

export async function loadAllDsrsPage(
  filter: { status?: DsrStatus; kind?: DsrKind } = {},
  opts: { from: number; to: number },
): Promise<{ rows: DataSubjectRequest[]; total: number }> {
  const supabase = createServiceRoleClient() as unknown as SupabaseClient;
  let q = supabase
    .from("data_subject_requests")
    .select(
      "id, business_id, user_id, kind, status, reason, payload, scheduled_for, completed_at, cancelled_at, cancellation_reason, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(opts.from, opts.to);

  if (filter.status) q = q.eq("status", filter.status);
  if (filter.kind) q = q.eq("kind", filter.kind);

  const { data, error, count } = await q;
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).map(
    coerceDsr,
  );
  return { rows, total: count ?? rows.length };
}

export { buildExportBundle } from "@/lib/privacy/export-bundle";

export async function loadExportSummary(
  exportId: string,
  userId: string,
): Promise<DataExportSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("data_exports")
    .select("id, request_id, byte_size, expires_at, created_at")
    .eq("id", exportId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    requestId: String(r.request_id),
    byteSize: Number(r.byte_size ?? 0),
    expiresAt: String(r.expires_at),
    createdAt: String(r.created_at),
  };
}

export async function loadExportPayload(
  exportId: string,
  userId: string,
): Promise<unknown | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("data_exports")
    .select("payload, expires_at, user_id")
    .eq("id", exportId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  if (new Date(String(r.expires_at)).getTime() <= Date.now()) return null;
  return r.payload ?? null;
}

function coerceDsr(r: Record<string, unknown>): DataSubjectRequest {
  return {
    id: String(r.id),
    businessId: String(r.business_id),
    userId: String(r.user_id),
    kind: r.kind as DsrKind,
    status: r.status as DsrStatus,
    reason: (r.reason as string | null) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    scheduledFor: (r.scheduled_for as string | null) ?? null,
    completedAt: (r.completed_at as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
    cancellationReason: (r.cancellation_reason as string | null) ?? null,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}
