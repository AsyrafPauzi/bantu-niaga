import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const DEMO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
export const DEFAULT_OWNER_EMAIL = "owner@demo.bantuniaga.local";
export const DEFAULT_OWNER_PASSWORD = "DemoPassword!2026";
export const DEMO_MONTHS = 6;

export function loadDotEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function createServiceAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function malaysiaTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
}

/** Deterministic UUID for demo seed rows. */
export function demoUuid(block: string, seq: number): string {
  const hex = seq.toString(16).padStart(12, "0");
  return `${block}-0000-4000-8000-${hex}`;
}

export function daysAgoIso(days: number, hour = 10): string {
  const today = malaysiaTodayYmd();
  const d = new Date(
    `${today}T${String(hour).padStart(2, "0")}:00:00+08:00`,
  );
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function daysFromNowYmd(days: number): string {
  const today = malaysiaTodayYmd();
  const d = new Date(`${today}T12:00:00+08:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function shareHashFromIndex(i: number): string {
  return `d${String(i).padStart(7, "0")}`.slice(0, 8);
}
