import "server-only";

import {
  partitionFollowUpDesk,
  type FollowUpDeskRow,
} from "@/lib/marketing/follow-up-desk";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DESK_SELECT =
  "id, name, phone_e164, order_count, last_purchase_at, last_contacted_at, auto_tags";

const LIMIT = 20;
const FETCH_CAP = 80;

export type FollowUpDeskData = {
  dormant: FollowUpDeskRow[];
  noPurchase: FollowUpDeskRow[];
  notMessaged: FollowUpDeskRow[];
};

export async function loadFollowUpDesk(
  businessId: string,
): Promise<FollowUpDeskData> {
  const supabase = await createSupabaseServerClient();

  const base = () =>
    supabase
      .from("customers")
      .select(DESK_SELECT)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .is("merged_into_id", null)
      .not("phone_e164", "is", null)
      .limit(FETCH_CAP);

  const notContactedCutoff = new Date(
    Date.now() - 30 * 86_400_000,
  ).toISOString();

  const [dormantRes, noPurchaseRes, notMessagedRes] = await Promise.all([
    base().overlaps("auto_tags", ["dormant", "at-risk"]),
    base().eq("order_count", 0).is("last_purchase_at", null),
    base().or(
      `last_contacted_at.is.null,last_contacted_at.lt.${notContactedCutoff}`,
    ),
  ]);

  if (dormantRes.error) throw new Error(dormantRes.error.message);
  if (noPurchaseRes.error) throw new Error(noPurchaseRes.error.message);
  if (notMessagedRes.error) throw new Error(notMessagedRes.error.message);

  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      phone_e164: string | null;
      order_count: number | null;
      last_purchase_at: string | null;
      last_contacted_at: string | null;
      auto_tags: string[] | null;
    }
  >();

  for (const row of [
    ...(dormantRes.data ?? []),
    ...(noPurchaseRes.data ?? []),
    ...(notMessagedRes.data ?? []),
  ]) {
    const r = row as {
      id: string;
      name: string;
      phone_e164: string | null;
      order_count: number | null;
      last_purchase_at: string | null;
      last_contacted_at: string | null;
      auto_tags: string[] | null;
    };
    byId.set(r.id, r);
  }

  return partitionFollowUpDesk(Array.from(byId.values()), {
    now: new Date(),
    notContactedDays: 30,
    limit: LIMIT,
  });
}
