import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** YYYY-MM key for the current calendar month. */
function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export interface EmailCogsRow {
  business_id: string;
  business_name: string | null;
  emails_sent: number;
  email_cogs_myr: number;
  plan_mrr_myr: number | null;
  guardrail_status: string;
  month: string;
}

export interface EmailCogsSummary {
  month: string;
  total_emails_sent: number;
  total_email_cogs_myr: number;
  businesses_ok: number;
  businesses_warn: number;
  businesses_throttled: number;
  businesses_flagged: number;
}

export interface EmailCogsResponse {
  ok: true;
  summary: EmailCogsSummary;
  flagged: EmailCogsRow[];
}

/**
 * GET /api/super-admin/analytics/email-cogs
 *
 * Platform-admin only. Returns platform-wide email COGS aggregates for the
 * current month, plus a list of every business whose guardrail_status is not
 * 'ok' (i.e. warn or throttled).
 *
 * Uses the service-role client so it can read across all tenants bypassing RLS.
 *
 * Response shape:
 * {
 *   ok: true,
 *   summary: {
 *     month: "YYYY-MM",
 *     total_emails_sent: number,
 *     total_email_cogs_myr: number,
 *     businesses_ok: number,
 *     businesses_warn: number,
 *     businesses_throttled: number,
 *     businesses_flagged: number,
 *   },
 *   flagged: [
 *     {
 *       business_id: string,
 *       business_name: string | null,
 *       emails_sent: number,
 *       email_cogs_myr: number,
 *       plan_mrr_myr: number | null,
 *       guardrail_status: "warn" | "throttled",
 *       month: string,
 *     },
 *     ...
 *   ]
 * }
 */
export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    // requirePlatformAdmin redirects on auth failure; if it throws, treat as
    // unauthorized (e.g. when called as a plain fetch rather than a page navigation).
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const month = currentMonthKey();
  const svc = createServiceRoleClient();

  // Fetch all rows for the current month using the service-role client.
  // We limit to 5 000 rows which is orders of magnitude above any realistic
  // tenant count; add pagination if the platform ever exceeds that.
  const { data: rows, error } = await svc
    .from("business_usage_monthly")
    .select(
      "business_id, emails_sent, email_cogs_myr, plan_mrr_myr, guardrail_status",
    )
    .eq("month", month)
    .limit(5000);

  if (error) {
    console.error("[email-cogs] DB error:", error.message);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to load usage data." },
      { status: 500 },
    );
  }

  // Attempt to resolve business names via the businesses table. Failures here
  // are non-fatal; we fall back to null names.
  const businessIds = (rows ?? []).map((r) => r.business_id as string);
  const nameMap = new Map<string, string | null>();

  if (businessIds.length > 0) {
    const { data: businesses } = await svc
      .from("businesses")
      .select("id, name")
      .in("id", businessIds);

    for (const b of businesses ?? []) {
      nameMap.set(b.id as string, (b.name as string | null) ?? null);
    }
  }

  // Aggregate
  let totalEmailsSent = 0;
  let totalEmailCogsMyr = 0;
  let countOk = 0;
  let countWarn = 0;
  let countThrottled = 0;

  const flagged: EmailCogsRow[] = [];

  for (const row of rows ?? []) {
    const sent = Number(row.emails_sent ?? 0);
    const cogs = Number(row.email_cogs_myr ?? 0);
    const status = (row.guardrail_status as string | null) ?? "ok";

    totalEmailsSent += sent;
    totalEmailCogsMyr += cogs;

    if (status === "warn") countWarn++;
    else if (status === "throttled") countThrottled++;
    else countOk++;

    if (status !== "ok") {
      flagged.push({
        business_id: row.business_id as string,
        business_name: nameMap.get(row.business_id as string) ?? null,
        emails_sent: sent,
        email_cogs_myr: cogs,
        plan_mrr_myr:
          row.plan_mrr_myr != null ? Number(row.plan_mrr_myr) : null,
        guardrail_status: status,
        month,
      });
    }
  }

  // Sort flagged by COGS descending so the most expensive appear first.
  flagged.sort((a, b) => b.email_cogs_myr - a.email_cogs_myr);

  const response: EmailCogsResponse = {
    ok: true,
    summary: {
      month,
      total_emails_sent: totalEmailsSent,
      total_email_cogs_myr: Math.round(totalEmailCogsMyr * 100) / 100,
      businesses_ok: countOk,
      businesses_warn: countWarn,
      businesses_throttled: countThrottled,
      businesses_flagged: countWarn + countThrottled,
    },
    flagged,
  };

  return NextResponse.json(response);
}
