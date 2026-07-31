import type { AutoSegmentKey } from "@/lib/marketing/segments-rules";
import {
  AUTO_KEY_LABEL,
  autoKeyToCustomerTag,
} from "@/lib/marketing/segments-rules";
import type { SegmentRules } from "@/lib/marketing/segments-rules";
import { formatMyr } from "@/lib/marketing/metrics";

export const AUTO_SEGMENT_BLURB: Record<AutoSegmentKey, string> = {
  vip: "Highest lifetime spend in your CRM",
  repeat: "Two or more orders on record",
  new: "Recently added, still building history",
  at_risk: "No purchase in the last 60 days",
  dormant: "No purchase in the last 120 days",
};

export function segmentCustomersHref(autoKey: AutoSegmentKey): string {
  const tag = autoKeyToCustomerTag(autoKey);
  return `/marketing/customers?tags=${encodeURIComponent(tag)}`;
}

export function broadcastNewHref(segmentId?: string): string {
  if (!segmentId) return "/marketing/broadcasts/new";
  return `/marketing/broadcasts/new?segment_id=${encodeURIComponent(segmentId)}`;
}

export function fmtSegmentRel(iso: string | null): string {
  if (!iso) return "Not refreshed yet";
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hr ago`;
  const days = Math.round(diffSec / 86400);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return `${Math.round(days / 30)} mo ago`;
}

export function buildSegmentRuleSummary(
  segment: {
    kind: "auto" | "custom";
    auto_key: AutoSegmentKey | null;
    rules: SegmentRules | null;
  },
): { label: string; value: string }[] {
  if (segment.kind === "auto" && segment.auto_key) {
    return [
      {
        label: "How it works",
        value: `Customers with the ${AUTO_KEY_LABEL[segment.auto_key]} auto-tag — updated when you refresh tags or when orders sync.`,
      },
      {
        label: "CRM filter",
        value: `Tag: ${autoKeyToCustomerTag(segment.auto_key)}`,
      },
    ];
  }

  const rules = segment.rules ?? {};
  const rows: { label: string; value: string }[] = [];

  if (rules.tags_any && rules.tags_any.length > 0) {
    rows.push({ label: "Has any tag", value: rules.tags_any.join(", ") });
  }
  if (typeof rules.min_spend_myr === "number") {
    rows.push({ label: "Min spend", value: formatMyr(rules.min_spend_myr) });
  }
  if (typeof rules.max_spend_myr === "number") {
    rows.push({ label: "Max spend", value: formatMyr(rules.max_spend_myr) });
  }
  if (typeof rules.inactive_days === "number") {
    rows.push({
      label: "Inactive",
      value: `${rules.inactive_days}+ days without a purchase`,
    });
  }
  if (rules.sources && rules.sources.length > 0) {
    rows.push({ label: "Source", value: rules.sources.join(", ") });
  }
  if (rules.manual_tags_any && rules.manual_tags_any.length > 0) {
    rows.push({
      label: "Manual tags",
      value: rules.manual_tags_any.join(", "),
    });
  }
  if (rules.auto_tags_any && rules.auto_tags_any.length > 0) {
    rows.push({
      label: "Auto tags",
      value: rules.auto_tags_any.join(", "),
    });
  }
  if (rows.length === 0) {
    rows.push({
      label: "Rules",
      value: "No filters — every active customer matches.",
    });
  }
  return rows;
}
