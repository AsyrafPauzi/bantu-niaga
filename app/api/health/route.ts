import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { logger } from "@/lib/logger";

/**
 * GET /api/health
 *
 * Liveness + lightweight readiness probe. Returns 200 when the process
 * is running AND can successfully round-trip a query to Supabase, 503
 * otherwise. Designed for Vercel / k8s health checks and external
 * uptime monitors (e.g. Better Stack, UptimeRobot).
 *
 * Body shape is stable so dashboards can graph the latency field:
 *
 *   {
 *     status:    "ok" | "degraded",
 *     service:   "bantuniaga",
 *     version:   "0.1.0",
 *     env:       "production" | "development",
 *     timestamp: ISO string,
 *     checks: {
 *       supabase: { ok, latencyMs?, error? }
 *     }
 *   }
 *
 * Cached for 5 seconds at the edge to absorb monitor-storm spikes
 * without hammering the DB.
 *
 * Anonymous — matches the unauthenticated allow-list in middleware.ts.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SERVICE = "bantuniaga";
const VERSION = "0.1.0";

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

async function probeSupabase(): Promise<CheckResult> {
  if (!getSupabasePublicEnv()) {
    return { ok: false, error: "supabase_env_missing" };
  }
  const started = Date.now();
  try {
    const svc = createServiceRoleClient();
    // `count: 'exact', head: true` is the cheapest round-trip — no row
    // payload, just a count from the planner. Limited to 1 to avoid any
    // large scans even on a misconfigured table.
    const { error } = await svc
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) {
      return { ok: false, error: error.code ?? "db_error" };
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.name : "unknown",
    };
  }
}

export async function GET() {
  const supabaseCheck = await probeSupabase();
  const allOk = supabaseCheck.ok;

  const body = {
    status: allOk ? "ok" : "degraded",
    service: SERVICE,
    version: VERSION,
    env: process.env.NODE_ENV ?? "unknown",
    timestamp: new Date().toISOString(),
    checks: {
      supabase: supabaseCheck,
    },
  };

  if (!allOk) {
    logger.child({ module: "health" }).warn("health_degraded", body);
  }

  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
    headers: {
      // Allow CDN edge caching for 5s — uptime monitors can poll
      // aggressively without DDoSing the DB.
      "Cache-Control": "public, max-age=5, s-maxage=5",
    },
  });
}
