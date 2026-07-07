import { describe, expect, it } from "vitest";
import {
  InsufficientCreditsError,
  isInsufficientCreditsError,
} from "@/lib/ai/credits";

describe("credit spend errors", () => {
  it("detects InsufficientCreditsError instance", () => {
    expect(isInsufficientCreditsError(new InsufficientCreditsError())).toBe(
      true,
    );
  });

  it("detects insufficient_credits message from RPC", () => {
    expect(
      isInsufficientCreditsError(new Error("insufficient_credits")),
    ).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isInsufficientCreditsError(new Error("network"))).toBe(false);
  });
});
