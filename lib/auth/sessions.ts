import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  locationFromIp,
  parseClientIp,
  parseUserAgent,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/device";

export interface UserSessionRow {
  id: string;
  device_label: string;
  location_label: string | null;
  last_seen_at: string;
  created_at: string;
  revoked_at: string | null;
}

const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  };
}

export async function getCurrentSessionId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function listActiveSessions(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSessionRow[]> {
  const { data, error } = await supabase
    .from("user_sessions")
    .select(
      "id, device_label, location_label, last_seen_at, created_at, revoked_at",
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as UserSessionRow[];
}

interface SessionRequestMeta {
  userAgent: string | null;
  forwardedFor: string | null;
  realIp: string | null;
}

export async function ensureCurrentSession(
  supabase: SupabaseClient,
  userId: string,
  meta: SessionRequestMeta,
): Promise<{ sessionId: string; created: boolean }> {
  const currentId = await getCurrentSessionId();
  const now = new Date().toISOString();

  if (currentId) {
    const { data: existing } = await supabase
      .from("user_sessions")
      .select("id")
      .eq("id", currentId)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("user_sessions")
        .update({ last_seen_at: now })
        .eq("id", existing.id);
      return { sessionId: existing.id, created: false };
    }
  }

  const ip = parseClientIp(meta.forwardedFor, meta.realIp);
  const { data: created, error } = await supabase
    .from("user_sessions")
    .insert({
      user_id: userId,
      device_label: parseUserAgent(meta.userAgent),
      user_agent: meta.userAgent,
      ip_address: ip,
      location_label: locationFromIp(ip),
      last_seen_at: now,
    })
    .select("id")
    .maybeSingle();

  if (error || !created?.id) {
    throw new Error(error?.message ?? "Could not create session");
  }

  return { sessionId: created.id, created: true };
}

export async function registerNewSession(
  supabase: SupabaseClient,
  userId: string,
  meta: SessionRequestMeta,
): Promise<string> {
  const ip = parseClientIp(meta.forwardedFor, meta.realIp);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("user_sessions")
    .insert({
      user_id: userId,
      device_label: parseUserAgent(meta.userAgent),
      user_agent: meta.userAgent,
      ip_address: ip,
      location_label: locationFromIp(ip),
      last_seen_at: now,
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not register session");
  }

  return data.id;
}

export async function revokeOtherSessions(
  supabase: SupabaseClient,
  userId: string,
  keepSessionId: string | null,
): Promise<void> {
  let query = supabase
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (keepSessionId) {
    query = query.neq("id", keepSessionId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
}

export { SESSION_COOKIE_NAME };
