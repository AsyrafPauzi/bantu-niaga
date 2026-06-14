# Social integrations — Meta (Facebook + Instagram Business)

Marketing M7. Lets tenants:

1. Connect one or more Facebook Pages (and their linked Instagram Business
   accounts) from `/settings/integrations`.
2. Publish a `content_plan` entry directly to those accounts from
   `/marketing/content/[id]`.
3. Pull live impressions / reach / engagement from the Graph API into the
   "Insights from Meta" panel on the same page.

The integration is **server configured, tenant connected**: the platform
owner sets `META_APP_ID` and `META_APP_SECRET` in the environment **once**;
every tenant on that server can then click "Connect with Facebook" and
hand the app a Page access token in the standard OAuth flow.

---

## 1. Database schema

Three tables, all created in
`supabase/migrations/00000000000016_social_integrations.sql`.

| Table | Purpose |
| --- | --- |
| `social_accounts` | One row per connected FB Page or IG Business account. Stores `access_token` (Page token), provider, external id, name, picture, status. |
| `social_post_publishes` | One row per publish attempt of a `content_plan` to a `social_account`. Tracks `status` (queued / posted / failed), the external post id, permalink, error message. |
| `social_post_metrics` | Snapshot of Graph insights for a publish row (impressions, reach, engagement, likes, comments, shares, saves, video views). Re-inserted on demand from the Refresh button. |

All three are tenant-scoped via `business_id` and follow the
**tenant + platform-admin read** RLS pattern (same shape as marketplace
and settings).

The unique constraint `(business_id, provider, external_id)` on
`social_accounts` means re-running OAuth idempotently upserts existing
rows — no duplicate Pages, no orphaned tokens.

---

## 2. Code layout

```
lib/social/
  meta.ts                      Graph API client (OAuth, publish, insights)
  load.ts                      Server-side loaders (RLS-aware)
  types.ts                     Shared TypeScript types

app/api/social/meta/
  connect/route.ts             GET → redirect to Meta OAuth dialog
  callback/route.ts            GET → exchange code, upsert accounts
  disconnect/route.ts          POST → mark account disconnected
  post/route.ts                POST → publish content_plan → FB/IG
  insights/[publishId]/route.ts GET → refresh Graph insights for a publish

components/settings/integrations/
  CallbackToast.tsx            "Connected!" / error toast after OAuth
  DisconnectSocialButton.tsx   Per-account disconnect

components/marketing/social/
  PublishPanel.tsx             Picker + caption/image inputs + Publish
  InsightsPanel.tsx            Per-publish metrics card list
  InsightsRefreshButton.tsx    Refresh client component

app/(app)/settings/integrations/page.tsx       wires Connect / Disconnect
app/(app)/marketing/content/[id]/page.tsx      wires Publish + Insights
```

---

## 3. Auth + OAuth flow

```
User clicks "Connect with Facebook"
        │
        ▼
GET /api/social/meta/connect
   - requires session + marketing.content surface
   - mints a random `state`, stashes in `bn_meta_oauth_state` cookie (10 min)
   - 302 → https://www.facebook.com/v19.0/dialog/oauth?...&state=...
        │
        ▼
User grants permission on Meta's domain
        │
        ▼
Meta 302 → GET /api/social/meta/callback?code=...&state=...
   1. verify state cookie
   2. exchange code → short-lived user token
   3. exchange short → long-lived user token (60d)
   4. GET /me/accounts → Pages[] (each with a Page access token)
   5. for each Page:
         upsert social_accounts (provider=facebook)
         GET /{page-id}?fields=instagram_business_account
         if linked: upsert social_accounts (provider=instagram)
   6. insert audit_log row
        │
        ▼
302 → /settings/integrations?meta=connected&detail=<N>fb_<M>ig
   CallbackToast renders "Connected 1 Facebook Page and 1 Instagram Business account"
```

Long-lived **Page** access tokens have no expiry per Meta's documentation,
so `social_accounts.token_expires_at` is `NULL` for Page rows. We still
record `token_issued_at` so the UI can show "issued 12 days ago" and a
future cron can re-validate tokens.

The OAuth callback uses the **service-role** Supabase client because the
upserts happen in a clean cookie context. Service-role bypasses RLS, so
every write is paired with an explicit `business_id = user.businessId`
check.

---

## 4. Publishing

`POST /api/social/meta/post` accepts:

```ts
{
  contentPlanId: uuid,
  accountIds: uuid[],       // 1–10 social_accounts
  captionOverride?: string,
  imageUrl?: string,        // public URL — required for IG, optional for FB
  scheduledAt?: ISO string  // FB only; must be 10min–6mo in the future
}
```

For each account we:

1. Open a `social_post_publishes` row with `status='queued'` so the audit
   trail is intact even if Graph errors out half-way.
2. Call the Graph API:
   - **Facebook Page**: `POST /{page-id}/photos` if `imageUrl` is provided,
     else `POST /{page-id}/feed`.
   - **Instagram Business**: 2-step — `POST /{ig-id}/media` to create a
     container, then `POST /{ig-id}/media_publish` with the returned
     `creation_id`. Then `GET /{media-id}?fields=permalink`.
3. On success, flip the publish row to `posted` with the `external_post_id`
   and `permalink`. On failure, flip to `failed` with the error message.
4. If at least one account succeeded, flip the underlying `content_plan`
   row to `status='posted'` so the Marketing calendar reflects reality.

The endpoint never throws 500 on a partial failure; the per-account
result list is returned to the caller for inline rendering. This is the
same pattern the marketplace activate endpoint uses.

---

## 5. Insights

`GET /api/social/meta/insights/[publishId]` is **call-on-demand**. It
hits the Graph API for the publish's `external_post_id`, normalises the
response, and inserts a fresh row into `social_post_metrics`. The
Insights tab always reads the latest row per publish.

Why not background sync? Two reasons:

- It avoids an always-on worker for the first version.
- Graph's rate limit (200 calls/h/user/Page) is plenty for tap-to-refresh
  but not for high-frequency polling. A future M8 can add an opt-in
  hourly cron.

Metric mapping (normalised):

| Field | Facebook source | Instagram source |
| --- | --- | --- |
| `impressions` | `post_impressions` | `impressions` |
| `reach` | `post_impressions_unique` | `reach` |
| `engaged_users` | `post_engaged_users` | `engagement` |
| `likes` | sum of `post_reactions_by_type_total` | `like_count` |
| `comments` | post `comments.summary.total_count` | `comments_count` |
| `shares` | post `shares.count` | (n/a) |
| `saves` | (n/a) | `saved` |
| `video_views` | (n/a in v1) | `video_views` |

---

## 6. Security notes

- **Tokens are server-only.** `lib/social/load.ts` exposes
  `loadAccountWithTokenForPublish()` which returns the token, but it's
  only imported by API route handlers — never by a Server Component
  that renders into the browser.
- **No token logging.** `lib/social/meta.ts` deliberately keeps the
  access token out of error messages.
- **CSRF.** The connect flow uses an HttpOnly state cookie (`bn_meta_oauth_state`,
  10-minute TTL). The callback rejects a missing or mismatched state.
- **Disconnect.** Marks the row `status='disconnected'` and zeros the
  `access_token` column. The Page is **not** removed at Meta's end —
  the user can also revoke the app from Meta's Settings → Apps.

---

## 7. Adding more providers

The TikTok and WhatsApp Business cards in `/settings/integrations` are
intentional placeholders. To add another provider:

1. Extend the `SocialProvider` type and the CHECK constraint on
   `social_accounts.provider` (a tiny new migration).
2. Add a sibling file `lib/social/<provider>.ts` with the same shape as
   `meta.ts` (`buildAuthUrl`, `exchangeCodeForToken`, `publishPost`,
   `getInsights`).
3. Add `/api/social/<provider>/{connect,callback,disconnect,post,insights}`
   routes that re-use the same DB tables.
4. Add a card in `CHANNELS[]` in `app/(app)/settings/integrations/page.tsx`
   with a `provider` value matching the new enum.
5. Update `PublishPanel.tsx` channel-match logic.

The `content_plan.channel` column already has slots for `tiktok` so the
publish path can light up the moment a `lib/social/tiktok.ts` lands.
