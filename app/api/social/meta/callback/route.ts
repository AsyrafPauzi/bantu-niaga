import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCurrentUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  exchangeCodeForToken,
  getIgBusinessForPage,
  getLongLivedUserToken,
  getPagePicture,
  isMetaConfigured,
  listUserPages,
  MetaApiError,
  META_SCOPES,
} from "@/lib/social/meta";

/**
 * GET /api/social/meta/callback
 *
 * Meta redirects here after the OAuth dialog. We:
 *
 *   1. Verify `state` against the cookie we set in /connect
 *   2. Exchange `?code=` for a short-lived user token
 *   3. Exchange that for a long-lived user token
 *   4. List the user's Pages → save one row per Page (provider=facebook)
 *      with its long-lived Page access token
 *   5. For each Page that has a linked IG Business account, save a
 *      second row (provider=instagram) using the same Page token
 *      (Meta's IG endpoints accept the Page token).
 *
 * Then redirect back to /settings/integrations with `?connected=…`
 * so the page can toast a success message.
 *
 * Service-role is used for the writes because the OAuth callback runs
 * in a clean cookie context — RLS would block the insert.
 */

export const dynamic = "force-dynamic";

const STATE_COOKIE = "bn_meta_oauth_state";

export async function GET(request: Request) {
  // Authenticate first so we know whose tenant to attach accounts to.
  let user;
  try {
    user = await getCurrentUser();
    if (!canSurface(user.role, "marketing", "content")) {
      return redirectToSettings("error", "forbidden");
    }
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return redirectToSettings("error", "session_expired");
    }
    throw e;
  }

  if (!isMetaConfigured()) {
    return redirectToSettings("error", "not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  if (errParam) {
    // User canceled the FB dialog or denied permission.
    return redirectToSettings(
      "error",
      url.searchParams.get("error_reason") ?? errParam,
    );
  }
  if (!code || !state) {
    return redirectToSettings("error", "missing_code_or_state");
  }

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (!expectedState || expectedState !== state) {
    return redirectToSettings("error", "invalid_state");
  }

  try {
    // OAuth dance.
    const short = await exchangeCodeForToken(code);
    const long = await getLongLivedUserToken(short.access_token);
    const pages = await listUserPages(long.access_token);

    if (pages.length === 0) {
      return redirectToSettings("error", "no_pages_found");
    }

    const svc = createServiceRoleClient();
    const now = new Date().toISOString();
    let connectedFb = 0;
    let connectedIg = 0;

    for (const page of pages) {
      // 1. Save the Facebook Page row.
      const picture = await getPagePicture(page.id, page.access_token);
      const { error: pageErr } = await svc
        .from("social_accounts")
        .upsert(
          {
            business_id: user.businessId,
            provider: "facebook",
            external_id: page.id,
            name: page.name,
            username: null,
            picture_url: picture,
            access_token: page.access_token,
            token_issued_at: now,
            token_expires_at: null, // long-lived Page tokens don't expire
            scopes: Array.from(META_SCOPES),
            status: "active",
            linked_fb_page_id: page.id,
            connected_by_user_id: user.id,
            connected_at: now,
            last_synced_at: now,
          },
          { onConflict: "business_id,provider,external_id" },
        );
      if (!pageErr) connectedFb++;

      // 2. Try to save the linked IG Business row (best effort).
      try {
        const ig = await getIgBusinessForPage(page.id, page.access_token);
        if (ig) {
          const { error: igErr } = await svc
            .from("social_accounts")
            .upsert(
              {
                business_id: user.businessId,
                provider: "instagram",
                external_id: ig.id,
                name: ig.name ?? ig.username ?? `Instagram (${page.name})`,
                username: ig.username ?? null,
                picture_url: ig.profile_picture_url ?? null,
                access_token: page.access_token, // reuse Page token
                token_issued_at: now,
                token_expires_at: null,
                scopes: Array.from(META_SCOPES),
                status: "active",
                linked_fb_page_id: page.id,
                connected_by_user_id: user.id,
                connected_at: now,
                last_synced_at: now,
              },
              { onConflict: "business_id,provider,external_id" },
            );
          if (!igErr) connectedIg++;
        }
      } catch {
        // Non-fatal — Page connected even if IG discovery failed.
      }
    }

    // Audit log.
    await svc.from("audit_log").insert({
      business_id: user.businessId,
      actor_user_id: user.id,
      action: "social.meta.connected",
      entity_type: "social_account",
      entity_id: null,
      diff: { pages: connectedFb, instagram_business: connectedIg },
    });

    const summary = `${connectedFb}fb_${connectedIg}ig`;
    return redirectToSettings("connected", summary);
  } catch (e) {
    if (e instanceof MetaApiError) {
      return redirectToSettings("error", e.code);
    }
    throw e;
  }
}

/**
 * Returns a safe redirect to `/settings/integrations`.
 *
 * `detail` is freeform — sanitize it so an attacker cannot inject CRLF
 * (header splitting) or oversize payloads into the URL. The known-good
 * channel for status is "connected" | "error"; we re-validate that to
 * be defensive even though TypeScript enforces it at compile time.
 */
function redirectToSettings(status: "connected" | "error", detail: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const safeDetail = detail
    // strip CR / LF / NUL to block response splitting
    .replace(/[\r\n\0]/g, "")
    // strip anything but printable ASCII so we don't pass unicode through
    // URL params and confuse logs
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 100);
  const safeStatus = status === "connected" ? "connected" : "error";
  const params = new URLSearchParams({ meta: safeStatus, detail: safeDetail });

  // Validate the base URL once — if the env var was tampered with we
  // refuse rather than redirect to an attacker-controlled origin.
  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "config_error", message: "Invalid NEXT_PUBLIC_APP_URL." } },
      { status: 500 },
    );
  }

  const dest = new URL("/settings/integrations", baseUrl);
  dest.search = params.toString();
  return NextResponse.redirect(dest, { status: 302 });
}
