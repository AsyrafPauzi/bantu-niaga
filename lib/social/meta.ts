/**
 * Meta (Facebook + Instagram Business) Graph API client.
 *
 * Wraps the four Graph endpoints we actually use:
 *
 *   1. OAuth — exchange code → short token → long-lived Page tokens
 *   2. Pages — list the user's Pages + linked Instagram Business accounts
 *   3. Publish — post to a Facebook Page or an Instagram Business account
 *   4. Insights — fetch impressions / reach / engagement for a post
 *
 * Design notes:
 *
 * - All functions throw `MetaApiError` with a *friendly* message on
 *   failure so the calling API route can surface it in the UI without
 *   leaking the Graph response shape.
 *
 * - `isMetaConfigured()` is exported so UI surfaces can show a "Configure
 *   META_APP_ID first" hint instead of a broken "Connect" button. None
 *   of the API routes assume the env vars are set — they 400 with a
 *   clear message when called against an unconfigured server.
 *
 * - We deliberately do NOT store user access tokens — only the long-lived
 *   Page access token. Page tokens have no expiry per Meta docs, so we
 *   keep `token_expires_at` NULL for them; `token_issued_at` is the
 *   only date we expose in the UI.
 *
 * - Graph API version: pinned to v19.0 (Meta keeps old versions alive
 *   for 2+ years; bump from a single constant when needed).
 */

import "server-only";

const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_BASE = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

/**
 * The scopes we request during OAuth. Each scope is required for a
 * specific feature — keep this list lean to avoid Meta's app review
 * friction.
 */
export const META_SCOPES = [
  "pages_show_list", // list user's Pages
  "pages_read_engagement", // read Page posts + insights
  "pages_manage_posts", // create posts on the Page
  "pages_read_user_content", // read engagement on the post
  "instagram_basic", // see linked IG account
  "instagram_content_publish", // publish to IG Business
  "instagram_manage_insights", // read IG insights
  "business_management", // refresh Page token via Business Manager
] as const;

// ─────────────────────────────────────────────────────────────────────────
// Config helpers
// ─────────────────────────────────────────────────────────────────────────

export interface MetaConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

/**
 * Resolve config from environment. Returns `null` when any required var
 * is missing — callers must handle that case (the UI shows a setup hint
 * and the API routes 400 with the missing var names).
 */
export function readMetaConfig(): MetaConfig | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri =
    process.env.META_REDIRECT_URI ??
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/social/meta/callback`
      : null);

  if (!appId || !appSecret || !redirectUri) return null;
  return { appId, appSecret, redirectUri };
}

export function isMetaConfigured(): boolean {
  return readMetaConfig() !== null;
}

export function missingMetaEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.META_APP_ID) missing.push("META_APP_ID");
  if (!process.env.META_APP_SECRET) missing.push("META_APP_SECRET");
  if (!process.env.META_REDIRECT_URI && !process.env.NEXT_PUBLIC_APP_URL) {
    missing.push("META_REDIRECT_URI (or NEXT_PUBLIC_APP_URL)");
  }
  return missing;
}

// ─────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Internal fetch wrapper
// ─────────────────────────────────────────────────────────────────────────

interface GraphErrorEnvelope {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

async function graphFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      // Meta is happy with this UA — also useful when tailing access logs.
      headers: {
        ...(init?.headers ?? {}),
        "User-Agent": "Bantu-Niaga/1.0 (+social-integrations)",
      },
      // Never let Next cache Graph responses — every call must be fresh.
      cache: "no-store",
    });
  } catch (e) {
    throw new MetaApiError(
      `Network error talking to Meta Graph API: ${(e as Error).message}`,
      "network_error",
      503,
    );
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response → keep raw text in the error.
      throw new MetaApiError(
        `Meta returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
        "invalid_response",
        res.status,
      );
    }
  }

  if (!res.ok) {
    const env = (json ?? {}) as GraphErrorEnvelope;
    const msg = env.error?.message ?? `Meta API error HTTP ${res.status}`;
    throw new MetaApiError(msg, env.error?.type ?? "graph_error", res.status, json);
  }

  return json as T;
}

// ─────────────────────────────────────────────────────────────────────────
// OAuth — Step 1: build the dialog URL
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build the Facebook Login dialog URL for the connect flow. `state`
 * should be a server-generated random token that we verify in the
 * callback to prevent CSRF.
 */
export function buildAuthUrl(state: string): string {
  const cfg = readMetaConfig();
  if (!cfg) {
    throw new MetaApiError(
      "Meta is not configured on this server. Add META_APP_ID, META_APP_SECRET, " +
        "and META_REDIRECT_URI (or NEXT_PUBLIC_APP_URL) to .env.local.",
      "not_configured",
      400,
    );
  }
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    state,
    scope: META_SCOPES.join(","),
    response_type: "code",
  });
  return `${OAUTH_BASE}?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────────────────
// OAuth — Step 2: exchange code → short-lived user token
// ─────────────────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const cfg = readMetaConfig();
  if (!cfg) {
    throw new MetaApiError("Meta not configured", "not_configured", 400);
  }
  const params = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: cfg.redirectUri,
    code,
  });
  return graphFetch<TokenResponse>(
    `${GRAPH_BASE}/oauth/access_token?${params.toString()}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// OAuth — Step 3: short-lived → long-lived user token (~60 days)
// ─────────────────────────────────────────────────────────────────────────

export async function getLongLivedUserToken(
  shortLivedToken: string,
): Promise<TokenResponse> {
  const cfg = readMetaConfig();
  if (!cfg) {
    throw new MetaApiError("Meta not configured", "not_configured", 400);
  }
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: shortLivedToken,
  });
  return graphFetch<TokenResponse>(
    `${GRAPH_BASE}/oauth/access_token?${params.toString()}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 4: list user's Pages with Page-scoped access tokens
// ─────────────────────────────────────────────────────────────────────────

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[];
}

interface PagesEnvelope {
  data: MetaPage[];
  paging?: { cursors: { before: string; after: string } };
}

export async function listUserPages(userToken: string): Promise<MetaPage[]> {
  const params = new URLSearchParams({
    access_token: userToken,
    fields: "id,name,access_token,category,tasks,picture",
    limit: "200",
  });
  const res = await graphFetch<PagesEnvelope>(
    `${GRAPH_BASE}/me/accounts?${params.toString()}`,
  );
  return res.data ?? [];
}

// ─────────────────────────────────────────────────────────────────────────
// Step 5: discover the IG Business account linked to a Page
// ─────────────────────────────────────────────────────────────────────────

export interface IgBusinessAccount {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

interface IgPageEnvelope {
  instagram_business_account?: { id: string };
}

export async function getIgBusinessForPage(
  pageId: string,
  pageToken: string,
): Promise<IgBusinessAccount | null> {
  const pageRes = await graphFetch<IgPageEnvelope>(
    `${GRAPH_BASE}/${encodeURIComponent(pageId)}?fields=instagram_business_account&access_token=${encodeURIComponent(pageToken)}`,
  );
  const igId = pageRes.instagram_business_account?.id;
  if (!igId) return null;

  const fields = "id,username,name,profile_picture_url,followers_count,media_count";
  const igRes = await graphFetch<IgBusinessAccount>(
    `${GRAPH_BASE}/${encodeURIComponent(igId)}?fields=${fields}&access_token=${encodeURIComponent(pageToken)}`,
  );
  return igRes;
}

// ─────────────────────────────────────────────────────────────────────────
// Page picture (avatar) — used in the integration card
// ─────────────────────────────────────────────────────────────────────────

interface PicEnvelope {
  data: { url: string; width?: number; height?: number };
}

export async function getPagePicture(
  pageId: string,
  pageToken: string,
): Promise<string | null> {
  try {
    const res = await graphFetch<PicEnvelope>(
      `${GRAPH_BASE}/${encodeURIComponent(pageId)}/picture?type=large&redirect=false&access_token=${encodeURIComponent(pageToken)}`,
    );
    return res.data?.url ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Publish — Facebook Page post
// ─────────────────────────────────────────────────────────────────────────

export interface FbPostResult {
  id: string;
  permalink_url?: string;
}

interface PublishFbInput {
  pageId: string;
  pageToken: string;
  message: string;
  /** Optional public image URL — Meta fetches it. */
  imageUrl?: string | null;
  /** Optional scheduled timestamp (epoch seconds, must be 10min–6mo away). */
  scheduledPublishTime?: number;
}

export async function publishFacebookPagePost(
  input: PublishFbInput,
): Promise<FbPostResult> {
  const { pageId, pageToken, message, imageUrl, scheduledPublishTime } = input;

  if (imageUrl) {
    const params = new URLSearchParams({
      access_token: pageToken,
      url: imageUrl,
      caption: message,
    });
    if (scheduledPublishTime) {
      params.set("published", "false");
      params.set("scheduled_publish_time", String(scheduledPublishTime));
    }
    const res = await graphFetch<{ id: string; post_id?: string }>(
      `${GRAPH_BASE}/${encodeURIComponent(pageId)}/photos`,
      { method: "POST", body: params },
    );
    const postId = res.post_id ?? res.id;
    return { id: postId, permalink_url: buildFbPostUrl(pageId, postId) };
  }

  const params = new URLSearchParams({
    access_token: pageToken,
    message,
  });
  if (scheduledPublishTime) {
    params.set("published", "false");
    params.set("scheduled_publish_time", String(scheduledPublishTime));
  }
  const res = await graphFetch<{ id: string }>(
    `${GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`,
    { method: "POST", body: params },
  );
  return { id: res.id, permalink_url: buildFbPostUrl(pageId, res.id) };
}

function buildFbPostUrl(pageId: string, postId: string): string {
  // Meta returns ids of the form "pageId_postId" or just "postId"; we
  // normalise to a permalink that always opens to the right post.
  const tail = postId.includes("_") ? postId.split("_").pop()! : postId;
  return `https://www.facebook.com/${pageId}/posts/${tail}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Publish — Instagram Business post (2-step)
// ─────────────────────────────────────────────────────────────────────────

interface PublishIgInput {
  igUserId: string;
  pageToken: string;
  imageUrl: string; // IG requires media; text-only is not supported
  caption?: string;
}

export interface IgPublishResult {
  id: string; // The published media id
  permalink?: string;
}

export async function publishInstagramPost(
  input: PublishIgInput,
): Promise<IgPublishResult> {
  const { igUserId, pageToken, imageUrl, caption } = input;

  // Step 1: create a media container.
  const createParams = new URLSearchParams({
    access_token: pageToken,
    image_url: imageUrl,
  });
  if (caption) createParams.set("caption", caption);
  const created = await graphFetch<{ id: string }>(
    `${GRAPH_BASE}/${encodeURIComponent(igUserId)}/media`,
    { method: "POST", body: createParams },
  );

  // Step 2: publish the container.
  const publishParams = new URLSearchParams({
    access_token: pageToken,
    creation_id: created.id,
  });
  const published = await graphFetch<{ id: string }>(
    `${GRAPH_BASE}/${encodeURIComponent(igUserId)}/media_publish`,
    { method: "POST", body: publishParams },
  );

  // Step 3 (best-effort): resolve the permalink.
  let permalink: string | undefined;
  try {
    const res = await graphFetch<{ permalink: string }>(
      `${GRAPH_BASE}/${encodeURIComponent(published.id)}?fields=permalink&access_token=${encodeURIComponent(pageToken)}`,
    );
    permalink = res.permalink;
  } catch {
    // ignored — the publish itself succeeded.
  }
  return { id: published.id, permalink };
}

// ─────────────────────────────────────────────────────────────────────────
// Insights — Facebook post
// ─────────────────────────────────────────────────────────────────────────

const FB_INSIGHTS_METRICS = [
  "post_impressions",
  "post_impressions_unique", // reach
  "post_engaged_users",
  "post_clicks",
  "post_reactions_by_type_total",
].join(",");

interface InsightDatum {
  name: string;
  values: { value: number | Record<string, number> }[];
}

interface InsightsEnvelope {
  data: InsightDatum[];
}

export interface NormalizedInsights {
  impressions: number;
  reach: number;
  engaged_users: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  video_views: number;
  raw: unknown;
}

export async function getFbPostInsights(
  postId: string,
  pageToken: string,
): Promise<NormalizedInsights> {
  const params = new URLSearchParams({
    metric: FB_INSIGHTS_METRICS,
    access_token: pageToken,
  });
  const res = await graphFetch<InsightsEnvelope>(
    `${GRAPH_BASE}/${encodeURIComponent(postId)}/insights?${params.toString()}`,
  );

  let impressions = 0;
  let reach = 0;
  let engaged = 0;
  let likes = 0;
  for (const d of res.data ?? []) {
    const v = d.values?.[0]?.value;
    if (d.name === "post_impressions" && typeof v === "number") impressions = v;
    if (d.name === "post_impressions_unique" && typeof v === "number") reach = v;
    if (d.name === "post_engaged_users" && typeof v === "number") engaged = v;
    if (d.name === "post_reactions_by_type_total" && typeof v === "object" && v) {
      likes = Object.values(v as Record<string, number>).reduce(
        (sum, n) => sum + (typeof n === "number" ? n : 0),
        0,
      );
    }
  }

  // Fetch comments + shares separately (they live on the post node, not insights).
  let comments = 0;
  let shares = 0;
  try {
    const postRes = await graphFetch<{
      comments?: { summary?: { total_count: number } };
      shares?: { count: number };
    }>(
      `${GRAPH_BASE}/${encodeURIComponent(postId)}?fields=comments.summary(true).limit(0),shares&access_token=${encodeURIComponent(pageToken)}`,
    );
    comments = postRes.comments?.summary?.total_count ?? 0;
    shares = postRes.shares?.count ?? 0;
  } catch {
    // best-effort
  }

  return {
    impressions,
    reach,
    engaged_users: engaged,
    likes,
    comments,
    shares,
    saves: 0,
    video_views: 0,
    raw: res,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Insights — Instagram media
// ─────────────────────────────────────────────────────────────────────────

const IG_INSIGHTS_METRICS = [
  "impressions",
  "reach",
  "engagement",
  "saved",
  "video_views",
].join(",");

export async function getIgMediaInsights(
  mediaId: string,
  pageToken: string,
): Promise<NormalizedInsights> {
  const params = new URLSearchParams({
    metric: IG_INSIGHTS_METRICS,
    access_token: pageToken,
  });
  const res = await graphFetch<InsightsEnvelope>(
    `${GRAPH_BASE}/${encodeURIComponent(mediaId)}/insights?${params.toString()}`,
  );

  let impressions = 0;
  let reach = 0;
  let engagement = 0;
  let saves = 0;
  let videoViews = 0;
  for (const d of res.data ?? []) {
    const v = d.values?.[0]?.value;
    if (typeof v !== "number") continue;
    if (d.name === "impressions") impressions = v;
    if (d.name === "reach") reach = v;
    if (d.name === "engagement") engagement = v;
    if (d.name === "saved") saves = v;
    if (d.name === "video_views") videoViews = v;
  }

  let likes = 0;
  let comments = 0;
  try {
    const mediaRes = await graphFetch<{
      like_count?: number;
      comments_count?: number;
    }>(
      `${GRAPH_BASE}/${encodeURIComponent(mediaId)}?fields=like_count,comments_count&access_token=${encodeURIComponent(pageToken)}`,
    );
    likes = mediaRes.like_count ?? 0;
    comments = mediaRes.comments_count ?? 0;
  } catch {
    // best-effort
  }

  return {
    impressions,
    reach,
    engaged_users: engagement,
    likes,
    comments,
    shares: 0,
    saves,
    video_views: videoViews,
    raw: res,
  };
}
