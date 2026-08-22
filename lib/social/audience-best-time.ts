import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getFbFansOnlineByHour,
  getIgOnlineFollowersByHour,
  MetaApiError,
  type HourlyAudienceMap,
} from "@/lib/social/meta";
import type { SocialAccountWithToken, SocialProvider } from "@/lib/social/types";

export type ContentChannel = "tiktok" | "instagram" | "facebook";

export type BestTimeUnavailableReason =
  | "unsupported_channel"
  | "meta_not_connected"
  | "insufficient_followers"
  | "no_data"
  | "meta_error";

export interface BestTimeResult {
  available: boolean;
  channel: ContentChannel;
  /** Human label, e.g. "Tue–Thu, 9–11 AM MYT" — only when available. */
  label?: string;
  /** Suggested schedule time HH:mm in MYT (start of peak window). */
  suggestTimeMyt?: string;
  /** Peak hours in MYT (0–23). */
  peakHoursMyt?: number[];
  accountUsername?: string | null;
  accountName?: string | null;
  reason?: BestTimeUnavailableReason;
  message?: string;
  connectHref?: string;
}

const MYT_OFFSET_HOURS = 8;

/**
 * Load the first active Meta account (+ token) for a provider.
 */
export async function loadActiveMetaAccountWithToken(
  client: SupabaseClient,
  businessId: string,
  provider: SocialProvider,
): Promise<SocialAccountWithToken | null> {
  const { data, error } = await client
    .from("social_accounts")
    .select(
      "id, business_id, provider, external_id, name, username, picture_url, " +
        "status, scopes, linked_fb_page_id, connected_at, token_issued_at, " +
        "token_expires_at, last_synced_at, connected_by_user_id, access_token",
    )
    .eq("business_id", businessId)
    .eq("provider", provider)
    .eq("status", "active")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as Record<string, unknown>;
  return {
    id: row.id as string,
    business_id: row.business_id as string,
    provider: row.provider as SocialProvider,
    external_id: row.external_id as string,
    name: row.name as string,
    username: (row.username as string | null) ?? null,
    picture_url: (row.picture_url as string | null) ?? null,
    status: row.status as SocialAccountWithToken["status"],
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    linked_fb_page_id: (row.linked_fb_page_id as string | null) ?? null,
    connected_at: row.connected_at as string,
    token_issued_at: (row.token_issued_at as string | null) ?? null,
    token_expires_at: (row.token_expires_at as string | null) ?? null,
    last_synced_at: (row.last_synced_at as string | null) ?? null,
    connected_by_user_id: (row.connected_by_user_id as string | null) ?? null,
    access_token: (row.access_token as string | null) ?? null,
  };
}

/** Shift UTC hour → MYT hour (Asia/Kuala_Lumpur, fixed +08). */
export function utcHourToMyt(utcHour: number): number {
  return (utcHour + MYT_OFFSET_HOURS) % 24;
}

export function findPeakWindow(hourly: HourlyAudienceMap): {
  startHourUtc: number;
  endHourUtc: number;
  peakHoursUtc: number[];
  total: number;
} | null {
  const scores = Array.from({ length: 24 }, (_, h) => hourly[h] ?? 0);
  const sumAll = scores.reduce((a, b) => a + b, 0);
  if (sumAll <= 0) return null;

  // Best contiguous 2-hour window.
  let bestStart = 0;
  let bestScore = -1;
  for (let h = 0; h < 24; h++) {
    const score = scores[h]! + scores[(h + 1) % 24]!;
    if (score > bestScore) {
      bestScore = score;
      bestStart = h;
    }
  }

  if (bestScore <= 0) return null;

  return {
    startHourUtc: bestStart,
    endHourUtc: (bestStart + 2) % 24,
    peakHoursUtc: [bestStart, (bestStart + 1) % 24],
    total: sumAll,
  };
}

function formatHourRangeMyt(startMyt: number, endMytExclusive: number): string {
  const fmt = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12} ${ampm}`;
  };
  return `${fmt(startMyt)}–${fmt(endMytExclusive)} MYT`;
}

/**
 * Prefer weekdays for the label when we only have hour-of-day aggregates
 * (Meta online_followers / page_fans_online don't break down by weekday in
 * the hourly map). We still say "weekdays" honestly rather than inventing
 * Tue–Thu.
 */
function buildLabel(startMyt: number, endMytExclusive: number): string {
  return `Weekdays, ${formatHourRangeMyt(startMyt, endMytExclusive)}`;
}

export function suggestTimeFromHourMyt(hourMyt: number): string {
  return `${String(hourMyt).padStart(2, "0")}:00`;
}

export async function resolveAudienceBestTime(opts: {
  client: SupabaseClient;
  businessId: string;
  channel: ContentChannel;
}): Promise<BestTimeResult> {
  const { client, businessId, channel } = opts;

  if (channel === "tiktok") {
    return {
      available: false,
      channel,
      reason: "unsupported_channel",
      message:
        "Best time from Meta is available for Instagram and Facebook once connected.",
      connectHref: "/settings/integrations",
    };
  }

  const provider: SocialProvider =
    channel === "instagram" ? "instagram" : "facebook";
  const account = await loadActiveMetaAccountWithToken(
    client,
    businessId,
    provider,
  );

  if (!account?.access_token) {
    return {
      available: false,
      channel,
      reason: "meta_not_connected",
      message: `Connect ${channel === "instagram" ? "Instagram" : "Facebook"} in Settings → Integrations to see when your audience is online.`,
      connectHref: "/settings/integrations",
    };
  }

  try {
    const hourly =
      channel === "instagram"
        ? await getIgOnlineFollowersByHour(
            account.external_id,
            account.access_token,
          )
        : await getFbFansOnlineByHour(
            account.external_id,
            account.access_token,
          );

    const peak = findPeakWindow(hourly);
    if (!peak) {
      return {
        available: false,
        channel,
        reason: "insufficient_followers",
        message:
          channel === "instagram"
            ? "Meta needs ~100+ Instagram followers before online audience data is available."
            : "No Facebook audience online data yet — try again after the Page has more fans activity.",
        accountUsername: account.username,
        accountName: account.name,
        connectHref: "/settings/integrations",
      };
    }

    const startMyt = utcHourToMyt(peak.startHourUtc);
    const endMyt = utcHourToMyt(peak.endHourUtc);
    const peakHoursMyt = peak.peakHoursUtc.map(utcHourToMyt);

    return {
      available: true,
      channel,
      label: buildLabel(startMyt, endMyt),
      suggestTimeMyt: suggestTimeFromHourMyt(startMyt),
      peakHoursMyt,
      accountUsername: account.username,
      accountName: account.name,
    };
  } catch (e) {
    if (e instanceof MetaApiError) {
      return {
        available: false,
        channel,
        reason: "meta_error",
        message: e.message,
        accountUsername: account.username,
        accountName: account.name,
        connectHref: "/settings/integrations",
      };
    }
    return {
      available: false,
      channel,
      reason: "no_data",
      message: "Could not load audience timing from Meta right now.",
      accountUsername: account.username,
      accountName: account.name,
      connectHref: "/settings/integrations",
    };
  }
}
