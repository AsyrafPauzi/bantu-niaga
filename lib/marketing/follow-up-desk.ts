import type { FollowUpReason } from "@/lib/marketing/follow-up-messages";

export type FollowUpDeskCustomer = {
  id: string;
  name: string;
  phone_e164: string | null;
  order_count: number | null;
  last_purchase_at: string | null;
  last_contacted_at: string | null;
  auto_tags: string[] | null;
};

export type FollowUpDeskRow = {
  id: string;
  name: string;
  phone_e164: string | null;
  reason: FollowUpReason;
};

function hasPhone(c: FollowUpDeskCustomer): boolean {
  return Boolean(c.phone_e164?.replace(/\D/g, ""));
}

function isDormantTag(tags: string[] | null): boolean {
  if (!tags?.length) return false;
  return tags.includes("dormant") || tags.includes("at-risk");
}

function isNoPurchase(c: FollowUpDeskCustomer): boolean {
  return (c.order_count ?? 0) === 0 && !c.last_purchase_at;
}

function isNotMessaged(
  c: FollowUpDeskCustomer,
  now: Date,
  notContactedDays: number,
): boolean {
  if (!c.last_contacted_at) return true;
  const cutoff = now.getTime() - notContactedDays * 86_400_000;
  return new Date(c.last_contacted_at).getTime() < cutoff;
}

function toRow(
  c: FollowUpDeskCustomer,
  reason: FollowUpReason,
): FollowUpDeskRow {
  return {
    id: c.id,
    name: c.name,
    phone_e164: c.phone_e164,
    reason,
  };
}

export function partitionFollowUpDesk(
  customers: ReadonlyArray<FollowUpDeskCustomer>,
  opts: { now: Date; notContactedDays: number; limit: number },
): {
  dormant: FollowUpDeskRow[];
  noPurchase: FollowUpDeskRow[];
  notMessaged: FollowUpDeskRow[];
} {
  const dormant: FollowUpDeskRow[] = [];
  const noPurchase: FollowUpDeskRow[] = [];
  const notMessaged: FollowUpDeskRow[] = [];

  for (const c of customers) {
    if (!hasPhone(c)) continue;
    if (isDormantTag(c.auto_tags) && dormant.length < opts.limit) {
      dormant.push(toRow(c, "dormant"));
    }
    if (isNoPurchase(c) && noPurchase.length < opts.limit) {
      noPurchase.push(toRow(c, "no_purchase"));
    }
    if (
      isNotMessaged(c, opts.now, opts.notContactedDays) &&
      notMessaged.length < opts.limit
    ) {
      notMessaged.push(toRow(c, "check_in"));
    }
  }

  return { dormant, noPurchase, notMessaged };
}
