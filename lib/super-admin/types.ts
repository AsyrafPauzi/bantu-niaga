import type { TierKey } from "@/lib/settings/plans";

export type PlatformAdmin = {
  userId: string;
  email: string;
  displayName: string | null;
};

export interface BusinessRowAdmin {
  id: string;
  idcompany: string;
  name: string;
  tier: TierKey;
  subscription_status: "active" | "past_due" | "cancelled" | "trial";
  subscription_renewal_at: string | null;
  state_code: string | null;
  credit_balance: number;
  created_at: string;
  /** Number of users in this business. Filled by loadBusinessSnapshots. */
  user_count?: number;
  health_score?: number;
  health_band?: "healthy" | "watch" | "at_risk" | "critical";
}

export interface UserRowAdmin {
  id: string;
  business_id: string;
  business_name?: string;
  business_tier?: TierKey;
  role:
    | "owner"
    | "manager"
    | "accountant"
    | "hr_officer"
    | "cashier"
    | "staff"
    | "marketing_officer"
    | "operations_officer"
    | "sales_rep";
  display_name: string | null;
  email: string | null;
  phone_e164: string | null;
  last_password_change_at: string | null;
  is_suspended?: boolean;
  created_at: string;
}

export interface AiAgentRow {
  id: string;
  slug: string;
  name: string;
  short_desc: string;
  pillar: string;
  icon: string;
  default_model: string;
  status: "active" | "beta" | "disabled";
  published_version_id: string | null;
  updated_at: string;
}

export interface AiAgentVersion {
  id: string;
  agent_id: string;
  version_label: string;
  system_prompt: string;
  allowed_actions: AllowedAction[];
  guardrails: Guardrail[];
  escalation: EscalationRule[];
  knowledge_base: KnowledgeSource[];
  default_tone: string | null;
  published_at: string | null;
  created_at: string;
}

export interface AllowedAction {
  key: string;
  label: string;
  note?: string;
  on: boolean;
}

export interface Guardrail {
  label: string;
  detail: string;
  severity: "always" | "enforced" | string;
}

export interface EscalationRule {
  trigger: string;
  target: string;
}

export interface KnowledgeSource {
  label: string;
  kind: string;
  size: string;
}

export interface AgentUsage7d {
  agent_slug: string;
  invocations: number;
  avg_latency_ms: number;
  failure_rate_pct: number;
  spend_myr: number;
  /** Last 7 daily buckets for the sparkline. */
  hourly: number[];
}

export interface MarketplaceAdminRow {
  id: string;
  slug: string;
  name: string;
  short_desc: string;
  pillar: string;
  icon: string;
  price_cents: number;
  cadence: "monthly" | "yearly" | "one_time" | "included";
  included_in_tier: string[];
  is_featured: boolean;
  status: "live" | "draft" | "disabled";
  /** Count of active business_addons. Filled by loadMarketplaceAdmin. */
  active_subscriptions: number;
  /** Sum of monthly recurring contribution in MYR. */
  mrr_myr: number;
}
