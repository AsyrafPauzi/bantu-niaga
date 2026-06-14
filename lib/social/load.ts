/**
 * Server-side loaders for the social-integrations surface.
 *
 * All loaders are tenant-scoped via the RLS-aware Supabase server client.
 * The only function that returns the access token is
 * `loadAccountWithTokenForPublish` — it's gated by RLS and the caller
 * must already have the marketing.content surface permission.
 *
 * Both `loadSocialAccounts` and `loadActiveSocialAccounts` are wrapped in
 * `react.cache()` so multiple Server Components that read connected
 * accounts within the same request only hit the database once.
 *
 * None of these loaders ever throw; instead they bubble a typed result
 * and let the page render an "empty" state if anything is missing.
 */

import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PublishWithMetrics,
  SocialAccount,
  SocialAccountStatus,
  SocialAccountWithToken,
  SocialProvider,
} from "./types";

const ACCOUNT_COLUMNS =
  "id, business_id, provider, external_id, name, username, picture_url, " +
  "status, scopes, linked_fb_page_id, connected_at, token_issued_at, " +
  "token_expires_at, last_synced_at, connected_by_user_id";

// ─────────────────────────────────────────────────────────────────────────
// Connected accounts (Settings → Integrations)
// ─────────────────────────────────────────────────────────────────────────

export const loadSocialAccounts = cache(
  async (businessId: string): Promise<SocialAccount[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("social_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("business_id", businessId)
      .order("connected_at", { ascending: false });

    if (error || !data) return [];
    return (data as unknown as Record<string, unknown>[]).map(coerceAccount);
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Active accounts only (used by the Publish panel)
// ─────────────────────────────────────────────────────────────────────────

export const loadActiveSocialAccounts = cache(
  async (
    businessId: string,
    provider?: SocialProvider,
  ): Promise<SocialAccount[]> => {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("social_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("business_id", businessId)
      .eq("status", "active")
      .order("provider", { ascending: true });
    if (provider) query = query.eq("provider", provider);
    const { data, error } = await query;

    if (error || !data) return [];
    return (data as unknown as Record<string, unknown>[]).map(coerceAccount);
  },
);

// ─────────────────────────────────────────────────────────────────────────
// One account + token (server-only, for publishing)
// ─────────────────────────────────────────────────────────────────────────

export async function loadAccountWithTokenForPublish(
  client: SupabaseClient,
  businessId: string,
  accountId: string,
): Promise<SocialAccountWithToken | null> {
  const { data, error } = await client
    .from("social_accounts")
    .select(`${ACCOUNT_COLUMNS}, access_token`)
    .eq("business_id", businessId)
    .eq("id", accountId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as Record<string, unknown>;
  const account = coerceAccount(row);
  return {
    ...account,
    access_token: (row.access_token as string | null | undefined) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Publishes for a single content_plan row (Insights tab)
// ─────────────────────────────────────────────────────────────────────────

interface RawJoinedPublish {
  id: string;
  business_id: string;
  content_plan_id: string;
  social_account_id: string;
  external_post_id: string | null;
  permalink: string | null;
  status: string;
  caption_snapshot: string | null;
  posted_at: string | null;
  error_message: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  social_accounts:
    | {
        provider: string;
        name: string;
        username: string | null;
        picture_url: string | null;
      }
    | {
        provider: string;
        name: string;
        username: string | null;
        picture_url: string | null;
      }[]
    | null;
}

export async function loadPublishesForContent(
  businessId: string,
  contentPlanId: string,
): Promise<PublishWithMetrics[]> {
  const supabase = await createSupabaseServerClient();
  const { data: pubs, error } = await supabase
    .from("social_post_publishes")
    .select(
      `id, business_id, content_plan_id, social_account_id, external_post_id,
       permalink, status, caption_snapshot, posted_at, error_message,
       created_by_user_id, created_at, updated_at,
       social_accounts:social_account_id(provider, name, username, picture_url)`,
    )
    .eq("business_id", businessId)
    .eq("content_plan_id", contentPlanId)
    .order("created_at", { ascending: false });

  if (error || !pubs) return [];

  // Pull the latest metrics row per publish in one query.
  const pubsTyped = pubs as unknown as RawJoinedPublish[];
  const pubIds = pubsTyped.map((p) => p.id);
  const metricsByPublishId = new Map<string, PublishWithMetrics["metrics"]>();
  if (pubIds.length > 0) {
    const { data: metrics } = await supabase
      .from("social_post_metrics")
      .select(
        "id, business_id, publish_id, impressions, reach, engaged_users, " +
          "likes, comments, shares, saves, video_views, fetched_at",
      )
      .eq("business_id", businessId)
      .in("publish_id", pubIds)
      .order("fetched_at", { ascending: false });
    if (metrics) {
      for (const m of metrics as unknown as Array<
        PublishWithMetrics["metrics"] & { publish_id: string }
      >) {
        if (m && !metricsByPublishId.has(m.publish_id)) {
          metricsByPublishId.set(m.publish_id, m);
        }
      }
    }
  }

  return pubsTyped.map((p) => {
    const acc = Array.isArray(p.social_accounts)
      ? p.social_accounts[0]
      : p.social_accounts;
    return {
      id: p.id,
      business_id: p.business_id,
      content_plan_id: p.content_plan_id,
      social_account_id: p.social_account_id,
      external_post_id: p.external_post_id,
      permalink: p.permalink,
      status: p.status as PublishWithMetrics["status"],
      caption_snapshot: p.caption_snapshot,
      posted_at: p.posted_at,
      error_message: p.error_message,
      created_by_user_id: p.created_by_user_id,
      created_at: p.created_at,
      updated_at: p.updated_at,
      account: {
        provider: ((acc?.provider as SocialProvider) ?? "facebook"),
        name: acc?.name ?? "Unknown",
        username: acc?.username ?? null,
        picture_url: acc?.picture_url ?? null,
      },
      metrics: metricsByPublishId.get(p.id) ?? null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function coerceAccount(row: Record<string, unknown>): SocialAccount {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    provider: String(row.provider) as SocialProvider,
    external_id: String(row.external_id),
    name: String(row.name),
    username: (row.username as string | null) ?? null,
    picture_url: (row.picture_url as string | null) ?? null,
    status: String(row.status) as SocialAccountStatus,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    linked_fb_page_id: (row.linked_fb_page_id as string | null) ?? null,
    connected_at: String(row.connected_at),
    token_issued_at: (row.token_issued_at as string | null) ?? null,
    token_expires_at: (row.token_expires_at as string | null) ?? null,
    last_synced_at: (row.last_synced_at as string | null) ?? null,
    connected_by_user_id:
      (row.connected_by_user_id as string | null) ?? null,
  };
}
