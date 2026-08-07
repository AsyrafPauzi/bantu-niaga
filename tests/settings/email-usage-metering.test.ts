import { describe, expect, it } from "vitest";

import {
  EMAIL_COGS_WARN_MRR_RATIO,
  RESEND_COGS_PER_EMAIL_MYR,
} from "@/lib/settings/email-usage-metering";
import { tierAmountMyr } from "@/lib/settings/subscription-billing";

describe("email COGS metering", () => {
  it("warn threshold matches pricing plan (15% of MRR)", () => {
    expect(EMAIL_COGS_WARN_MRR_RATIO).toBe(0.15);
    expect(RESEND_COGS_PER_EMAIL_MYR).toBe(0.01);
  });

  it("micro MRR triggers warn above ~15% email COGS", () => {
    const mrr = tierAmountMyr("micro");
    const warnAtEmails = Math.ceil(
      (mrr * EMAIL_COGS_WARN_MRR_RATIO) / RESEND_COGS_PER_EMAIL_MYR,
    );
    const cogs = warnAtEmails * RESEND_COGS_PER_EMAIL_MYR;
    expect(cogs / mrr).toBeGreaterThanOrEqual(EMAIL_COGS_WARN_MRR_RATIO);
  });
});
