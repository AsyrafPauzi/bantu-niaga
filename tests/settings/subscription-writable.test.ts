import { describe, expect, it } from "vitest";
import {
  SubscriptionPastDueError,
  assertSubscriptionWritable,
  isSubscriptionWritable,
} from "@/lib/settings/subscription-writable";

describe("subscription writable", () => {
  it("allows active and trial; blocks past_due and cancelled", () => {
    expect(isSubscriptionWritable("active")).toBe(true);
    expect(isSubscriptionWritable("trial")).toBe(true);
    expect(isSubscriptionWritable("past_due")).toBe(false);
    expect(isSubscriptionWritable("cancelled")).toBe(false);
  });

  it("assert throws SubscriptionPastDueError on past_due", () => {
    expect(() => assertSubscriptionWritable("past_due")).toThrow(
      SubscriptionPastDueError,
    );
    expect(() => assertSubscriptionWritable("active")).not.toThrow();
  });
});
