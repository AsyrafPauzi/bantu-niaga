import type { ModuleHeroVariant } from "@/components/dashboard/module-layout";
import type { KpiSnapshotResult } from "@/lib/marketing/dashboard-queries";
import { AUTO_SEGMENT_BLURB } from "@/lib/marketing/segment-display";
import type { AutoSegmentKey } from "@/lib/marketing/segments-rules";
import { formatCount } from "@/lib/marketing/metrics";

export function customersSubpageHero(
  snapshot: KpiSnapshotResult,
): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const headline =
    snapshot.totalCustomers === 0
      ? "Start your customer list"
      : snapshot.atRiskCount > 0
        ? `${formatCount(snapshot.atRiskCount)} need a nudge`
        : snapshot.dormantCount > 0
          ? `${formatCount(snapshot.dormantCount)} quiet for a while`
          : `${formatCount(snapshot.totalCustomers)} people know your brand`;

  const subcopy =
    snapshot.totalCustomers === 0
      ? "Add someone manually or import a CSV — auto-tags kick in once they have purchase history."
      : snapshot.atRiskCount > 0
        ? "No purchase in 60+ days. Filter at-risk, pick a segment, and send a win-back broadcast."
        : snapshot.dormantCount > 0
          ? `${formatCount(snapshot.dormantCount)} dormant 120+ days — a small promo often brings a few back.`
          : "Search, filter by tag, export, or open a profile to add notes.";

  return {
    headline,
    subcopy,
    variant:
      snapshot.atRiskCount > 0
        ? "attention"
        : snapshot.totalCustomers === 0
          ? "calm"
          : "marketing",
  };
}

export function segmentsSubpageHero(opts: {
  total: number;
  autoCount: number;
  customCount: number;
  totalMembers: number;
  largestSegment?: { name: string; count: number } | null;
  winBackMembers?: number;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  if (opts.total === 0) {
    return {
      headline: "Segments appear with your customers",
      subcopy:
        "Once people are in your CRM, VIP, repeat, new, at-risk, and dormant groups fill in automatically.",
      variant: "calm",
    };
  }

  if (opts.totalMembers === 0) {
    return {
      headline: `${opts.total} segment${opts.total === 1 ? "" : "s"} set up`,
      subcopy:
        "No members yet — add customers or connect POS/Finance so auto-tags can populate these groups.",
      variant: "calm",
    };
  }

  const headline =
    opts.largestSegment && opts.largestSegment.count > 0
      ? `${opts.largestSegment.name} is your biggest group`
      : `${formatCount(opts.totalMembers)} people across your segments`;

  let subcopy = `Pick a segment when you send a broadcast — ${opts.autoCount} built-in`;
  if (opts.customCount > 0) {
    subcopy += `, ${opts.customCount} custom`;
  }
  subcopy += ".";

  if ((opts.winBackMembers ?? 0) > 0) {
    subcopy = `${formatCount(opts.winBackMembers!)} in dormant or at-risk — strong win-back targets. ${subcopy}`;
  }

  return {
    headline,
    subcopy,
    variant: (opts.winBackMembers ?? 0) > 0 ? "attention" : "marketing",
  };
}

export function segmentDetailSubpageHero(opts: {
  name: string;
  kind: "auto" | "custom";
  autoKey: AutoSegmentKey | null;
  memberCount: number;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  if (opts.memberCount === 0) {
    return {
      headline: opts.name,
      subcopy:
        opts.kind === "auto" && opts.autoKey
          ? `${AUTO_SEGMENT_BLURB[opts.autoKey]} — no customers match yet.`
          : "No customers match these rules yet. Try widening the filters or add more people to your CRM.",
      variant: "calm",
    };
  }

  const blurb =
    opts.kind === "auto" && opts.autoKey
      ? AUTO_SEGMENT_BLURB[opts.autoKey]
      : "Custom rule-based group";

  return {
    headline: opts.name,
    subcopy: `${formatCount(opts.memberCount)} member${opts.memberCount === 1 ? "" : "s"} · ${blurb}`,
    variant:
      opts.autoKey === "at_risk" || opts.autoKey === "dormant"
        ? "attention"
        : "marketing",
  };
}

export function broadcastsSubpageHero(opts: {
  total: number;
  draftCount: number;
  sentCount: number;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const headline =
    opts.total === 0
      ? "Send your first broadcast"
      : opts.draftCount > 0
        ? `${opts.draftCount} draft${opts.draftCount === 1 ? "" : "s"} ready to send`
        : `${formatCount(opts.sentCount)} sent campaign${opts.sentCount === 1 ? "" : "s"}`;

  const subcopy =
    "WhatsApp click-to-chat and email — target a segment and track who was reached.";

  return { headline, subcopy, variant: "calm" };
}

export function couponsSubpageHero(opts: {
  total: number;
  activeCount: number;
  redeemedTotal: number;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const headline =
    opts.total === 0
      ? "Create your first coupon"
      : `${opts.activeCount} active code${opts.activeCount === 1 ? "" : "s"}`;

  const subcopy =
    opts.redeemedTotal > 0
      ? `${formatCount(opts.redeemedTotal)} redemption${opts.redeemedTotal === 1 ? "" : "s"} so far — share via WhatsApp or link.`
      : "Percentage or RM off — redeemable at Sales POS and shareable on /c/CODE.";

  return { headline, subcopy, variant: "calm" };
}

export function newCustomerSubpageHero(
  snapshot: KpiSnapshotResult,
): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const headline =
    snapshot.totalCustomers === 0
      ? "Your first customer"
      : "Add someone new";

  const subcopy =
    snapshot.totalCustomers === 0
      ? "Name and phone are enough to start. VIP and dormant tags appear once they buy from you."
      : `${formatCount(snapshot.totalCustomers)} in your CRM today — matching phone numbers will offer to merge, not duplicate.`;

  return {
    headline,
    subcopy,
    variant: snapshot.totalCustomers === 0 ? "calm" : "marketing",
  };
}

export function importCustomerSubpageHero(): {
  headline: string;
  subcopy: string;
  variant: ModuleHeroVariant;
} {
  return {
    headline: "Import your customer list",
    subcopy:
      "Upload CSV — we preview new rows, phone duplicates, and rejects before anything is saved.",
    variant: "marketing",
  };
}

export function customerDetailSubpageHero(opts: {
  name: string;
  autoTags: string[];
  totalSpendMyr: number;
  orderCount: number;
  lastPurchaseAt: string | null;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const first = opts.name.split(/\s+/)[0] ?? opts.name;
  const spend = opts.totalSpendMyr;
  const orders = opts.orderCount;

  if (opts.autoTags.includes("at-risk")) {
    return {
      headline: opts.name,
      subcopy: `${first} hasn't bought recently — a short WhatsApp or small offer often wins them back.`,
      variant: "attention",
    };
  }
  if (opts.autoTags.includes("dormant")) {
    return {
      headline: opts.name,
      subcopy: `Quiet for a while · ${orders} order${orders === 1 ? "" : "s"} · ${spend > 0 ? `RM ${spend.toFixed(0)} lifetime` : "no spend yet"}.`,
      variant: "calm",
    };
  }
  if (opts.autoTags.includes("vip")) {
    return {
      headline: opts.name,
      subcopy: `VIP · ${orders} order${orders === 1 ? "" : "s"} · RM ${spend.toFixed(0)} lifetime spend.`,
      variant: "marketing",
    };
  }
  if (opts.autoTags.includes("new")) {
    return {
      headline: opts.name,
      subcopy: `New to your list — ${orders === 0 ? "no purchases yet" : `${orders} order${orders === 1 ? "" : "s"} so far`}.`,
      variant: "marketing",
    };
  }
  if (opts.autoTags.includes("repeat")) {
    return {
      headline: opts.name,
      subcopy: `Repeat buyer · ${orders} order${orders === 1 ? "" : "s"} · RM ${spend.toFixed(0)} spent.`,
      variant: "marketing",
    };
  }

  const last = opts.lastPurchaseAt
    ? `Last purchase ${fmtCustomerRelShort(opts.lastPurchaseAt)}`
    : orders === 0
      ? "No purchases recorded yet"
      : `${orders} order${orders === 1 ? "" : "s"} on file`;

  return {
    headline: opts.name,
    subcopy: last,
    variant: "calm",
  };
}

function fmtCustomerRelShort(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.round(Math.max(0, Date.now() - then) / 86400000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export function buildCustomerMayaInsight(opts: {
  name: string;
  autoTags: string[];
  totalSpendMyr: number;
  orderCount: number;
}): string {
  const first = opts.name.split(" ")[0] ?? opts.name;
  const spend = opts.totalSpendMyr;
  const orders = opts.orderCount;

  if (opts.autoTags.includes("vip")) {
    return `${first} is one of your top spenders — RM ${spend.toFixed(2)} across ${orders} orders. A personal follow-up or VIP-only preview can deepen loyalty.`;
  }
  if (opts.autoTags.includes("at-risk")) {
    return `${first} hasn't purchased recently. A targeted 10–15% offer often brings at-risk customers back.`;
  }
  if (opts.autoTags.includes("dormant")) {
    return `${first} has been quiet for 120+ days. A short check-in or win-back coupon is worth trying.`;
  }
  if (opts.autoTags.includes("repeat")) {
    const gap = Math.max(0, 1000 - spend);
    return `${first} buys consistently. They're RM ${gap.toFixed(0)} from the VIP spend threshold.`;
  }
  return `Limited history for ${first} so far. A welcome message after their first order helps build repeat business.`;
}

export function newSegmentSubpageHero(opts: {
  customCount: number;
  totalMembers: number;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const headline =
    opts.customCount === 0
      ? "Your first custom segment"
      : "New custom segment";

  const subcopy =
    opts.customCount === 0
      ? "Stack rules on top of your built-in VIP, repeat, and win-back groups — the match counter updates as you type."
      : `${formatCount(opts.totalMembers)} people across all segments today — rules narrow that pool for targeted broadcasts.`;

  return { headline, subcopy, variant: "marketing" };
}

export function newCouponSubpageHero(opts: {
  activeCount: number;
  redeemedTotal: number;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const headline =
    opts.activeCount === 0 ? "Create your first coupon" : "New coupon code";

  const subcopy =
    opts.redeemedTotal > 0
      ? `${formatCount(opts.redeemedTotal)} redemption${opts.redeemedTotal === 1 ? "" : "s"} so far — share via WhatsApp, email, or at Sales POS.`
      : "Percentage or RM off — redeemable at Sales POS and shareable on /c/CODE.";

  return { headline, subcopy, variant: "marketing" };
}

export function couponDetailSubpageHero(opts: {
  code: string;
  name: string | null;
  type: "PCT" | "AMT";
  value: number;
  minSubtotal: number;
  status: "active" | "paused" | "expired";
  redeemedCount: number;
  totalLimit: number | null;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const discount =
    opts.type === "PCT"
      ? `${opts.value}% off`
      : `RM ${opts.value.toFixed(2)} off`;
  const min =
    opts.minSubtotal > 0
      ? ` · min RM ${opts.minSubtotal.toFixed(2)}`
      : "";
  const limit =
    opts.totalLimit != null
      ? ` · ${opts.redeemedCount}/${opts.totalLimit} used`
      : ` · ${opts.redeemedCount} redemption${opts.redeemedCount === 1 ? "" : "s"}`;

  if (opts.status === "expired") {
    return {
      headline: opts.code,
      subcopy: `Expired · ${discount}${min}${limit}`,
      variant: "calm",
    };
  }

  if (opts.status === "paused") {
    return {
      headline: opts.code,
      subcopy: `Paused · ${discount}${min} — reactivate when you're ready to share again.`,
      variant: "attention",
    };
  }

  return {
    headline: opts.code,
    subcopy:
      opts.name ??
      `${discount}${min}${limit} — share the link or redeem at POS.`,
    variant: "marketing",
  };
}

export function newBroadcastSubpageHero(opts?: {
  segmentName?: string | null;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const headline = opts?.segmentName
    ? `Broadcast to ${opts.segmentName}`
    : "New broadcast";

  const subcopy = opts?.segmentName
    ? "Segment pre-selected — pick a channel, write the message, then preview before you send."
    : "WhatsApp click-to-chat or branded email — target a segment and track who was reached.";

  return { headline, subcopy, variant: "marketing" };
}

export function broadcastDetailSubpageHero(opts: {
  name: string;
  channel: "whatsapp_ctc" | "email";
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  segmentName: string;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const channelLabel =
    opts.channel === "whatsapp_ctc" ? "WhatsApp" : "Email";
  const status = opts.status.replace("_", " ");

  if (opts.status === "draft") {
    return {
      headline: opts.name,
      subcopy: `Draft · ${channelLabel} · ${opts.segmentName} — recipients resolve when you send.`,
      variant: "calm",
    };
  }

  if (opts.status === "failed") {
    return {
      headline: opts.name,
      subcopy: `Send failed · ${opts.failedCount} of ${opts.totalRecipients} could not be delivered.`,
      variant: "attention",
    };
  }

  if (opts.status === "partially_sent") {
    return {
      headline: opts.name,
      subcopy: `${opts.sentCount} sent, ${opts.failedCount} failed · ${channelLabel} to ${opts.segmentName}.`,
      variant: "attention",
    };
  }

  if (opts.status === "sending") {
    return {
      headline: opts.name,
      subcopy: `Sending now · ${channelLabel} to ${opts.segmentName}.`,
      variant: "marketing",
    };
  }

  return {
    headline: opts.name,
    subcopy: `${status} · ${opts.sentCount} of ${opts.totalRecipients} reached · ${channelLabel} · ${opts.segmentName}.`,
    variant: "marketing",
  };
}

export function newContentSubpageHero(opts?: {
  prefillDateLabel?: string | null;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const headline = opts?.prefillDateLabel
    ? `Plan a post for ${opts.prefillDateLabel}`
    : "New social post";

  const subcopy = opts?.prefillDateLabel
    ? "Pick a channel, write a hook and caption — schedule it on the calendar or save as a draft."
    : "TikTok, Instagram, or Facebook — draft hooks and captions before you post manually.";

  return { headline, subcopy, variant: "marketing" };
}

export function contentDetailSubpageHero(opts: {
  hook: string | null;
  channel: "tiktok" | "instagram" | "facebook";
  status: "idea" | "drafted" | "scheduled" | "posted";
  scheduledAt: string | null;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const channelLabel =
    opts.channel === "tiktok"
      ? "TikTok"
      : opts.channel === "instagram"
        ? "Instagram"
        : "Facebook";

  const title = opts.hook?.trim() || "Untitled post";

  if (opts.status === "posted") {
    return {
      headline: title,
      subcopy: `Posted on ${channelLabel} — track engagement and share the caption again.`,
      variant: "marketing",
    };
  }

  if (opts.status === "scheduled" && opts.scheduledAt) {
    const when = new Date(opts.scheduledAt).toLocaleString("en-MY", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kuala_Lumpur",
    });
    return {
      headline: title,
      subcopy: `Scheduled ${when} · ${channelLabel} — copy the caption when you're ready to post.`,
      variant: "marketing",
    };
  }

  if (opts.status === "idea") {
    return {
      headline: title,
      subcopy: `Idea on ${channelLabel} — flesh out the hook and caption, then schedule or mark posted.`,
      variant: "calm",
    };
  }

  return {
    headline: title,
    subcopy: `Draft for ${channelLabel} — finish the caption, attach media, then schedule or post.`,
    variant: "calm",
  };
}

export function contentSubpageHero(opts: {
  monthLabel: string;
  scheduledCount: number;
  draftCount: number;
  postedCount: number;
}): { headline: string; subcopy: string; variant: ModuleHeroVariant } {
  const headline =
    opts.scheduledCount > 0
      ? `${opts.scheduledCount} post${opts.scheduledCount === 1 ? "" : "s"} scheduled in ${opts.monthLabel}`
      : opts.draftCount > 0
        ? `${opts.draftCount} draft${opts.draftCount === 1 ? "" : "s"} in the calendar`
        : "Plan your social content";

  const subcopy =
    opts.postedCount > 0
      ? `${formatCount(opts.postedCount)} marked posted — copy captions and share manually from each entry.`
      : "TikTok, Instagram, and Facebook — plan hooks and captions before you post.";

  return { headline, subcopy, variant: "calm" };
}
