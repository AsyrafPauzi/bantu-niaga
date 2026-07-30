import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAdminSnapshot } from "@/lib/ai/context/admin";
import { buildFinanceSnapshot } from "@/lib/ai/context/finance";
import { buildHrSnapshot } from "@/lib/ai/context/hr";
import { buildMarketingSnapshot } from "@/lib/ai/context/marketing";
import { buildOperationsSnapshot } from "@/lib/ai/context/operations";
import { buildSalesSnapshot } from "@/lib/ai/context/sales";
import type { AgentContext, PillarSnapshot } from "@/lib/ai/context/types";
import { buildHrDailyNotice } from "@/lib/ai/hr-daily-notice";
import { buildMarketingDailyNotice } from "@/lib/ai/marketing-daily-notice";
import { buildPillarDailyNotice } from "@/lib/ai/pillar-daily-notice";
import { buildSalesDailyNotice } from "@/lib/ai/sales-daily-notice";
import type { AgentSlug, TenantAgentDefinition } from "@/lib/settings/ai-agents-catalog";

type SnapshotBuilder = (
  ctx: AgentContext,
  client?: SupabaseClient,
) => Promise<PillarSnapshot>;

type NoticeBuilder = (
  snapshot: PillarSnapshot,
  displayName: string,
) => { title: string; body: string };

interface DailyNoticeAgentConfig {
  buildSnapshot: SnapshotBuilder;
  buildNotice: NoticeBuilder;
}

const PILLAR_NOTICE_CONFIG: Record<
  "finance" | "operations" | "admin",
  { pillarLabel: string; emptyMessage: string; calmMessage: string }
> = {
  finance: {
    pillarLabel: "Finance",
    emptyMessage:
      "No finance records yet — create an invoice or log a transaction.",
    calmMessage:
      "• No urgent Finance items today — invoices and cash flow look up to date.",
  },
  operations: {
    pillarLabel: "Operations",
    emptyMessage:
      "No operations data yet — add products, orders, or bookings.",
    calmMessage:
      "• No urgent Operations items today — stock and orders look on track.",
  },
  admin: {
    pillarLabel: "Admin",
    emptyMessage:
      "No admin activity yet — your business overview will appear here.",
    calmMessage:
      "• No urgent Admin items today — compliance and tasks look up to date.",
  },
};

function pillarNoticeBuilder(
  slug: keyof typeof PILLAR_NOTICE_CONFIG,
): NoticeBuilder {
  const config = PILLAR_NOTICE_CONFIG[slug];
  return (snapshot, displayName) =>
    buildPillarDailyNotice(
      snapshot,
      displayName,
      config.pillarLabel,
      config.emptyMessage,
      config.calmMessage,
    );
}

export const DAILY_NOTICE_AGENT_CONFIG: Partial<
  Record<AgentSlug, DailyNoticeAgentConfig>
> = {
  marketing: {
    buildSnapshot: buildMarketingSnapshot,
    buildNotice: buildMarketingDailyNotice,
  },
  finance: {
    buildSnapshot: buildFinanceSnapshot,
    buildNotice: pillarNoticeBuilder("finance"),
  },
  operations: {
    buildSnapshot: buildOperationsSnapshot,
    buildNotice: pillarNoticeBuilder("operations"),
  },
  sales: {
    buildSnapshot: buildSalesSnapshot,
    buildNotice: buildSalesDailyNotice,
  },
  hr: {
    buildSnapshot: buildHrSnapshot,
    buildNotice: buildHrDailyNotice,
  },
  admin: {
    buildSnapshot: buildAdminSnapshot,
    buildNotice: pillarNoticeBuilder("admin"),
  },
};

export async function buildLiveAgentNotice(
  def: TenantAgentDefinition,
  ctx: AgentContext,
  displayName: string,
): Promise<{ title: string; body: string } | null> {
  const config = DAILY_NOTICE_AGENT_CONFIG[def.slug];
  if (!config || !def.supportsDailyNotice) {
    return null;
  }

  const snapshot = await config.buildSnapshot(ctx);
  return config.buildNotice(snapshot, displayName);
}
