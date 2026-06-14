import { describe, expect, it } from "vitest";

import {
  TenantIsolationViolation,
  assertTenantOnly,
} from "@/lib/ai/context/guard";
import { renderBriefingText } from "@/lib/ai/context";
import type {
  AgentContext,
  PillarSnapshot,
} from "@/lib/ai/context/types";

const TENANT_A: AgentContext = Object.freeze({
  businessId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  userId: "user-a",
  role: "owner",
  impersonated: false,
});

const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("ai/context — assertTenantOnly", () => {
  it("passes when every row belongs to the tenant", () => {
    const rows = [
      { id: "1", business_id: TENANT_A.businessId },
      { id: "2", business_id: TENANT_A.businessId },
    ];
    expect(() => assertTenantOnly(rows, TENANT_A, "test")).not.toThrow();
  });

  it("throws when any row belongs to another tenant", () => {
    const rows = [
      { id: "1", business_id: TENANT_A.businessId },
      { id: "2", business_id: TENANT_B },
    ];
    expect(() => assertTenantOnly(rows, TENANT_A, "leak")).toThrow(
      TenantIsolationViolation,
    );
  });

  it("returns an empty array for null / undefined", () => {
    expect(assertTenantOnly(null, TENANT_A, "n")).toEqual([]);
    expect(assertTenantOnly(undefined, TENANT_A, "u")).toEqual([]);
  });

  it("ignores rows without a business_id column", () => {
    const rows = [{ id: "1" }, { id: "2", business_id: null }];
    expect(() =>
      assertTenantOnly(rows, TENANT_A, "no-col"),
    ).not.toThrow();
  });
});

describe("ai/context — renderBriefingText", () => {
  it("disclaims when the pillar has no data", () => {
    const snapshot: PillarSnapshot = {
      pillar: "operations",
      businessId: TENANT_A.businessId,
      generatedAt: "2026-06-14T00:00:00Z",
      available: false,
      headline: "no data",
      kpis: [],
      recent: [],
      attention: [],
    };
    const text = renderBriefingText(snapshot);
    expect(text).toContain("OPERATIONS overview");
    expect(text).toContain("WARNING: This pillar has no live data");
  });

  it("never embeds another tenant's id", () => {
    const snapshot: PillarSnapshot = {
      pillar: "finance",
      businessId: TENANT_A.businessId,
      generatedAt: "2026-06-14T00:00:00Z",
      available: true,
      headline: "1 invoice",
      kpis: [{ key: "x", label: "Revenue", value: 100, unit: "MYR" }],
      recent: [
        {
          id: "inv-1",
          label: "INV-1 · paid",
          meta: "RM 100",
          at: "2026-06-14T00:00:00Z",
        },
      ],
      attention: [],
    };
    const text = renderBriefingText(snapshot);
    expect(text).toContain(TENANT_A.businessId);
    expect(text).not.toContain(TENANT_B);
  });

  it("emits compact form: KPIs + recent + attention", () => {
    const snapshot: PillarSnapshot = {
      pillar: "marketing",
      businessId: TENANT_A.businessId,
      generatedAt: "2026-06-14T00:00:00Z",
      available: true,
      headline: "headline-text",
      kpis: [
        { key: "k", label: "Customers", value: 8 },
        { key: "k2", label: "Total spend", value: 540, unit: "MYR" },
      ],
      recent: [
        { id: "r1", label: "instagram · scheduled", meta: "post hook" },
      ],
      attention: [
        { id: "a1", label: "no social account connected", severity: "medium" },
      ],
      notes: "n",
    };
    const text = renderBriefingText(snapshot);
    expect(text).toContain("headline-text");
    expect(text).toContain("Customers: 8");
    expect(text).toContain("Total spend: 540 MYR");
    expect(text).toContain("instagram · scheduled");
    expect(text).toContain("[medium] no social account connected");
    expect(text).toContain("Notes: n");
    // Sanity check on size — should be small.
    expect(text.length).toBeLessThan(1000);
  });
});
