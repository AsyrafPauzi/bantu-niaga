export interface AuditAdminRow {
  id: string;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetBusinessId: string | null;
  businessName?: string;
  diff: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "tenant.agent_routing": "Agent routing",
  "user.impersonate_start": "Impersonation started",
  "user.impersonate_stop": "Impersonation ended",
  "user.suspend": "User suspended",
  "user.restore": "User restored",
  "user.set_role": "Role changed",
  "user.reset_password": "Password reset",
  "user.delete": "User deleted",
  "user.invite": "User invited",
  "business.set_tier": "Plan changed",
  "business.set_status": "Subscription status",
  "integration.upsert": "Integration updated",
  "integration.test.ok": "Integration test passed",
  "integration.test.fail": "Integration test failed",
  "marketplace.set_status": "Marketplace addon",
  "platform_admin.grant": "Admin granted",
};

export function formatAuditAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]!;
  return action
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDiffCompact(diff: Record<string, unknown>): string {
  const parts = Object.entries(diff)
    .filter(([, value]) => value != null && value !== "")
    .slice(0, 3)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(", ")}`;
      }
      if (typeof value === "object") {
        return key;
      }
      return `${key}: ${String(value)}`;
    });
  const text = parts.join(" · ");
  return text.length > 96 ? `${text.slice(0, 93)}…` : text || "—";
}

export function formatAuditDetails(
  action: string,
  diff: Record<string, unknown> | null,
): string {
  if (!diff || Object.keys(diff).length === 0) {
    return "—";
  }

  switch (action) {
    case "tenant.agent_routing": {
      const slug = String(diff.agent_slug ?? "agent");
      const mode = diff.reasoning_mode ? ` · ${String(diff.reasoning_mode)}` : "";
      const model = diff.model_override ? ` · ${String(diff.model_override)}` : "";
      return `${slug}${mode}${model}`;
    }
    case "business.set_tier":
    case "business.set_status":
    case "user.set_role":
    case "marketplace.set_status":
      return `${String(diff.from ?? "?")} → ${String(diff.to ?? "?")}`;
    case "user.suspend":
      return "Account suspended";
    case "user.restore":
      return "Account restored";
    case "user.impersonate_start":
      return String(diff.target_email ?? "Target user");
    case "user.invite":
    case "user.reset_password":
    case "user.delete":
      return String(diff.email ?? "—");
    case "integration.upsert": {
      const parts: string[] = [];
      if (diff.enabled === true) parts.push("Enabled");
      if (diff.enabled === false) parts.push("Disabled");
      const configKeys = diff.config_keys;
      if (Array.isArray(configKeys) && configKeys.length > 0) {
        parts.push(`Config: ${configKeys.join(", ")}`);
      }
      const secretKeys = diff.secret_keys;
      if (Array.isArray(secretKeys) && secretKeys.length > 0) {
        parts.push(`Secrets: ${secretKeys.join(", ")}`);
      }
      return parts.join(" · ") || "Updated";
    }
    case "integration.test.ok":
      return "Connection OK";
    case "integration.test.fail":
      return String(diff.error ?? "Test failed");
    case "platform_admin.grant":
      return String(diff.email ?? "—");
    default:
      return formatDiffCompact(diff);
  }
}

export type AuditCategory =
  | "all"
  | "user"
  | "tenant"
  | "integration"
  | "marketplace"
  | "platform";

export function auditMatchesCategory(
  action: string,
  category: AuditCategory,
): boolean {
  switch (category) {
    case "user":
      return action.startsWith("user.");
    case "tenant":
      return action.startsWith("tenant.") || action.startsWith("business.");
    case "integration":
      return action.startsWith("integration.");
    case "marketplace":
      return action.startsWith("marketplace.");
    case "platform":
      return action.startsWith("platform_admin.");
    case "all":
    default:
      return true;
  }
}
