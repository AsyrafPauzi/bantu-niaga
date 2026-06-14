/**
 * Shared types for the social-integrations surface.
 *
 * `SocialProvider` mirrors the CHECK constraint on `social_accounts.provider`
 * in migration 16. Keep both in sync.
 */

export type SocialProvider = "facebook" | "instagram";

export type SocialAccountStatus = "active" | "expired" | "disconnected";

export interface SocialAccount {
  id: string;
  business_id: string;
  provider: SocialProvider;
  external_id: string;
  name: string;
  username: string | null;
  picture_url: string | null;
  status: SocialAccountStatus;
  scopes: string[];
  linked_fb_page_id: string | null;
  connected_at: string;
  token_issued_at: string | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  connected_by_user_id: string | null;
}

/** A `social_accounts` row + the access_token. Server-only. */
export interface SocialAccountWithToken extends SocialAccount {
  access_token: string | null;
}

export type PublishStatus = "queued" | "posted" | "failed";

export interface SocialPostPublish {
  id: string;
  business_id: string;
  content_plan_id: string;
  social_account_id: string;
  external_post_id: string | null;
  permalink: string | null;
  status: PublishStatus;
  caption_snapshot: string | null;
  posted_at: string | null;
  error_message: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialPostMetrics {
  id: string;
  business_id: string;
  publish_id: string;
  impressions: number;
  reach: number;
  engaged_users: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  video_views: number;
  fetched_at: string;
}

/** Joined view used by the Content Detail → Insights tab. */
export interface PublishWithMetrics extends SocialPostPublish {
  account: Pick<SocialAccount, "provider" | "name" | "username" | "picture_url">;
  metrics: SocialPostMetrics | null;
}
