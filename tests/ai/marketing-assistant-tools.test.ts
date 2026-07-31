import { describe, expect, it } from "vitest";
import {
  EXTRA_ACTION_TOOLS,
  EXTRA_READ_TOOLS,
} from "@/lib/ai/marketing-assistant-extra-tools";
import { isMarketingActionTool } from "@/lib/ai/marketing-assistant-tools";

describe("marketing-assistant-tools", () => {
  it("classifies write tools as actions", () => {
    expect(isMarketingActionTool("create_broadcast_draft")).toBe(true);
    expect(isMarketingActionTool("create_coupon")).toBe(true);
    expect(isMarketingActionTool("create_content_draft")).toBe(true);
    expect(isMarketingActionTool("update_customer_note_or_tag")).toBe(true);
    expect(isMarketingActionTool("refresh_auto_tags")).toBe(true);
    expect(isMarketingActionTool("create_custom_segment")).toBe(true);
    expect(isMarketingActionTool("update_coupon_status")).toBe(true);
    expect(isMarketingActionTool("schedule_content")).toBe(true);
    expect(isMarketingActionTool("mark_content_posted")).toBe(true);
  });

  it("does not classify read tools as actions", () => {
    expect(isMarketingActionTool("get_marketing_overview")).toBe(false);
    expect(isMarketingActionTool("list_customers")).toBe(false);
    expect(isMarketingActionTool("list_segments")).toBe(false);
    expect(isMarketingActionTool("get_customer_profile")).toBe(false);
    expect(isMarketingActionTool("get_segment_detail")).toBe(false);
    expect(isMarketingActionTool("preview_segment_rules")).toBe(false);
    expect(isMarketingActionTool("list_coupons")).toBe(false);
    expect(isMarketingActionTool("list_broadcasts")).toBe(false);
    expect(isMarketingActionTool("list_content")).toBe(false);
    expect(isMarketingActionTool("unknown")).toBe(false);
  });

  it("exports disjoint read and action extra tool sets", () => {
    for (const name of EXTRA_READ_TOOLS) {
      expect(EXTRA_ACTION_TOOLS.has(name)).toBe(false);
    }
  });
});
