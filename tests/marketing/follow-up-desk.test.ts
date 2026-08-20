import { describe, expect, it } from "vitest";
import { partitionFollowUpDesk } from "@/lib/marketing/follow-up-desk";

const now = new Date("2026-08-20T12:00:00.000Z");

describe("partitionFollowUpDesk", () => {
  it("buckets dormant, no purchase, and not messaged with phone", () => {
    const { dormant, noPurchase, notMessaged } = partitionFollowUpDesk(
      [
        {
          id: "1",
          name: "Dormant Dee",
          phone_e164: "+601111",
          order_count: 3,
          last_purchase_at: "2025-01-01",
          last_contacted_at: "2026-08-19T00:00:00.000Z",
          auto_tags: ["dormant"],
        },
        {
          id: "2",
          name: "No Buy",
          phone_e164: "+601222",
          order_count: 0,
          last_purchase_at: null,
          last_contacted_at: "2026-08-19T00:00:00.000Z",
          auto_tags: [],
        },
        {
          id: "3",
          name: "Quiet",
          phone_e164: "+601333",
          order_count: 2,
          last_purchase_at: "2026-07-01",
          last_contacted_at: null,
          auto_tags: [],
        },
        {
          id: "4",
          name: "No phone",
          phone_e164: null,
          order_count: 0,
          last_purchase_at: null,
          last_contacted_at: null,
          auto_tags: ["dormant"],
        },
      ],
      { now, notContactedDays: 30, limit: 20 },
    );

    expect(dormant.map((r) => r.id)).toEqual(["1"]);
    expect(noPurchase.map((r) => r.id)).toEqual(["2"]);
    expect(notMessaged.map((r) => r.id)).toEqual(["3"]);
  });

  it("respects limit per panel", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `C${i}`,
      phone_e164: `+601${i}`,
      order_count: 0,
      last_purchase_at: null as string | null,
      last_contacted_at: null as string | null,
      auto_tags: ["dormant"],
    }));
    const out = partitionFollowUpDesk(many, {
      now,
      notContactedDays: 30,
      limit: 2,
    });
    expect(out.dormant).toHaveLength(2);
    expect(out.noPurchase).toHaveLength(2);
    expect(out.notMessaged).toHaveLength(2);
  });
});
