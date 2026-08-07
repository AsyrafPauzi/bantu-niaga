import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  ClipboardList,
  Megaphone,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { reasoningCreditHint } from "@/lib/settings/reasoning-credits";

export type AgentSlug =
  | "marketing"
  | "finance"
  | "operations"
  | "sales"
  | "hr"
  | "admin"
  | "boardroom";

export type ReasoningMode = "fast" | "deep";

/** ILMU models used per reasoning speed (Settings → AI Agent activation). */
export const REASONING_MODE_MODELS: Record<ReasoningMode, string> = {
  fast: "ilmu-mini-v3.3",
  deep: "ilmu-v3.1",
};

export const REASONING_MODES = ["fast", "deep"] as const satisfies readonly ReasoningMode[];

export function normalizeReasoningMode(
  mode: string | null | undefined,
): ReasoningMode {
  return mode === "deep" ? "deep" : "fast";
}

export function modelForReasoningMode(mode: ReasoningMode): string {
  return REASONING_MODE_MODELS[mode];
}

/** Platform admin override wins, then reasoning mode mapping. */
export function resolveAgentModel(opts: {
  reasoningMode: ReasoningMode;
  modelOverride?: string | null;
}): string {
  const override = opts.modelOverride?.trim();
  if (override) return override;
  return modelForReasoningMode(opts.reasoningMode);
}

export const ALLOWED_MODEL_OVERRIDES = [
  "ilmu-mini-v3.3",
  "ilmu-v3.1",
  "nemo-super",
  "gpt-4o-mini",
  "gpt-4o",
] as const;

export type AllowedModelOverride = (typeof ALLOWED_MODEL_OVERRIDES)[number];

/** Friendly labels for super-admin model override dropdown. */
export const MODEL_OVERRIDE_LABELS: Record<AllowedModelOverride, string> = {
  "ilmu-mini-v3.3": "ILMU Mini v3.3 (fast)",
  "ilmu-v3.1": "ILMU v3.1 (deep reasoning)",
  "nemo-super": "Nemo Super (agent / tools)",
  "gpt-4o-mini": "GPT-4o mini",
  "gpt-4o": "GPT-4o",
};

export function labelForModelOverride(model: string): string {
  return (
    MODEL_OVERRIDE_LABELS[model as AllowedModelOverride] ?? model
  );
}

export interface TenantAgentDefinition {
  slug: AgentSlug;
  addonSlug: string | null;
  defaultName: string;
  roleTitle: string;
  pillar: string;
  description: string;
  tone: "brand" | "accent";
  icon: LucideIcon;
  capabilities: string[];
  chatHref: string | null;
  supportsDailyNotice: boolean;
}

export const TENANT_AI_AGENTS: readonly TenantAgentDefinition[] = [
  {
    slug: "marketing",
    addonSlug: "marketing-assistant",
    defaultName: "Maya",
    roleTitle: "Marketing AI",
    pillar: "Marketing",
    description:
      "Answers CRM questions, reads your full Marketing module, drafts broadcasts/captions, and creates segments and coupons.",
    tone: "accent",
    icon: Megaphone,
    capabilities: [
      "CRM Q&A (VIP, dormant, segments, customer profiles)",
      "Read coupons, broadcasts, and content calendar",
      "Draft WhatsApp / email broadcasts",
      "Create coupons, segments, and content drafts",
      "Schedule posts and pause coupons",
      "Customer notes and tags",
      "Daily Marketing notice",
    ],
    chatHref: "/marketing?maya=open",
    supportsDailyNotice: true,
  },
  {
    slug: "finance",
    addonSlug: "finance-assistant",
    defaultName: "Fayza",
    roleTitle: "Finance AI",
    pillar: "Finance",
    description:
      "Checks invoices, spots duplicate expenses, and forecasts cash flow.",
    tone: "brand",
    icon: TrendingUp,
    capabilities: [
      "Invoice reconciliation help",
      "Duplicate expense detection",
      "30-day cash-flow forecast",
      "Tax-saving suggestions",
      "Daily Finance notice on Home",
    ],
    chatHref: "/finance?fayza=open",
    supportsDailyNotice: true,
  },
  {
    slug: "operations",
    addonSlug: "operations-assistant",
    defaultName: "Aiman",
    roleTitle: "Operations AI",
    pillar: "Operations",
    description:
      "Tracks stock, orders, and bookings — plans your day like ops staff.",
    tone: "brand",
    icon: ShoppingBag,
    capabilities: [
      "Today's ops briefing (overdue, bookings, low stock)",
      "Create and update orders & bookings in chat",
      "Add or edit products, services, and suppliers in chat",
      "Service catalogue + booking resource awareness",
      "Stays in Operations — redirects Finance/HR/Marketing/Sales questions",
      "Daily Operations notice on Home",
    ],
    chatHref: "/operations?aiman=open",
    supportsDailyNotice: true,
  },
  {
    slug: "sales",
    addonSlug: "sales-assistant",
    defaultName: "Sufi",
    roleTitle: "Sales AI",
    pillar: "Sales",
    description:
      "Plans like sales staff — clarifies, then helps chase leads and coach the counter.",
    tone: "accent",
    icon: Megaphone,
    capabilities: [
      "Staff-style clarify → plan → act",
      "Overdue and due-today lead coaching",
      "Create / update leads and notes in chat",
      "Convert won leads to Marketing customers",
      "Today's POS summary (cash vs DuitNow)",
      "Draft chase WhatsApp/SMS copy (owner sends)",
      "Daily sales notice on Home (optional toggle)",
      "Answers in Bahasa Malaysia or English",
    ],
    chatHref: "/sales?sufi=open",
    supportsDailyNotice: true,
  },
  {
    slug: "hr",
    addonSlug: "hr-assistant",
    defaultName: "Hana",
    roleTitle: "HR AI",
    pillar: "HR",
    description:
      "Plans like HR staff — clarifies, then helps with leave, cover, and team attention.",
    tone: "brand",
    icon: Users,
    capabilities: [
      "Staff-style clarify → plan → act",
      "Record leave by chat (annual, MC, emergency)",
      "Approve or reject pending leave requests",
      "Who is on leave today and pending approvals",
      "Team headcount and staff list from HR records",
      "Upcoming public holidays (with holiday add-on)",
      "Staff appraisal due dates and overdue checks (with appraisal add-on)",
      "Schedule and complete staff appraisals in chat (with appraisal add-on)",
      "Open onboarding checklist reminders",
      "Daily HR notice on Home (optional toggle)",
      "Answers in Bahasa Malaysia or English",
    ],
    chatHref: "/hr?hana=open",
    supportsDailyNotice: true,
  },
  {
    slug: "admin",
    addonSlug: "admin-assistant",
    defaultName: "Amir",
    roleTitle: "Admin AI",
    pillar: "Admin",
    description:
      "Tracks tasks, compliance deadlines, and document filing — your back-office copilot.",
    tone: "brand",
    icon: ClipboardList,
    capabilities: [
      "Task and deadline reminders",
      "SSM / licence renewal alerts",
      "Compliance checklist help",
      "Recent activity summaries",
      "Daily Admin notice on Home",
    ],
    chatHref: "/admin?amir=open",
    supportsDailyNotice: true,
  },
  {
    slug: "boardroom",
    addonSlug: "boardroom-weekly",
    defaultName: "Boardroom",
    roleTitle: "Executive briefing",
    pillar: "All modules",
    description:
      "Combines every module into a weekly briefing and strategic Q&A.",
    tone: "accent",
    icon: Briefcase,
    capabilities: [
      "Weekly executive briefing",
      "Cross-module Q&A",
      "Goal tracking and alerts",
      "Sunday digest email",
    ],
    chatHref: "/boardroom",
    supportsDailyNotice: false,
  },
] as const;

export const REASONING_MODE_LABELS: Record<ReasoningMode, string> = {
  fast: "Fast",
  deep: "Deep think",
};

export const REASONING_MODE_HINTS: Record<ReasoningMode, string> = {
  fast: `Uses ilmu-mini-v3.3 — quick replies. ${reasoningCreditHint("fast")}.`,
  deep: `Uses ilmu-v3.1 — stronger reasoning. ${reasoningCreditHint("deep")}.`,
};

export function agentBySlug(slug: string): TenantAgentDefinition | undefined {
  return TENANT_AI_AGENTS.find((a) => a.slug === slug);
}

export interface AgentListItem {
  slug: AgentSlug;
  display_name: string;
  assistant_enabled: boolean;
  daily_notice_enabled: boolean;
  reasoning_mode: ReasoningMode;
  daily_budget_myr: number;
  daily_budget_credits: number;
  addon_active: boolean;
  boardroom_unlocked: boolean;
  credits_used_month: number;
  spent_today_credits: number;
  spent_today_myr: number;
}

export interface AgentsOverview {
  agents: AgentListItem[];
  credit_balance: number;
  active_count: number;
  /** Subscribed module AI assistants (excludes Boardroom). */
  subscribed_agent_count: number;
  /** subscribed_agent_count × 100 — refilled monthly into the shared pool. */
  monthly_bundled_credits: number;
  /** Credits spent by all agents this calendar month (from shared pool). */
  credits_used_month: number;
  total_spent_today_credits: number;
  total_spent_today_myr: number;
  total_daily_budget_credits: number;
  total_daily_budget_myr: number;
  boardroom_unlocked: boolean;
  /** Deep reasoning (ilmu-v3.1) — Solo+ only. */
  deep_reasoning_allowed: boolean;
}
