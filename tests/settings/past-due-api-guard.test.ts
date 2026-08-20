import { describe, expect, it } from "vitest";
import { SubscriptionPastDueError } from "@/lib/settings/subscription-writable";
import { pastDueJsonResponse } from "@/lib/settings/past-due-response";

describe("pastDueJsonResponse", () => {
  it("returns 402 with subscription_past_due", async () => {
    const res = pastDueJsonResponse(new SubscriptionPastDueError());
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("subscription_past_due");
  });
});
