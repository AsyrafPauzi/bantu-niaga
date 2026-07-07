import { describe, expect, it } from "vitest";
import { BOARDROOM_MIN_AGENTS } from "@/lib/ai/boardroom-shared";

describe("boardroom unlock rule", () => {
  it("requires more than one active agent", () => {
    expect(BOARDROOM_MIN_AGENTS).toBe(2);
  });

  it("unlocks at two agents", () => {
    const activeCount = 2;
    expect(activeCount >= BOARDROOM_MIN_AGENTS).toBe(true);
  });

  it("stays locked with only HR assistant", () => {
    const activeCount = 1;
    expect(activeCount >= BOARDROOM_MIN_AGENTS).toBe(false);
  });
});
