import { describe, expect, it } from "vitest";
import {
  trimShortMemoryTurns,
  SHORT_MEMORY_MAX_TURNS,
} from "@/lib/ai/short-memory";

describe("short-memory", () => {
  it("caps turns and trims content", () => {
    const turns = Array.from({ length: 6 }, (_, i) => ({
      role: "user" as const,
      content: `message-${i}-${"x".repeat(500)}`,
    }));
    const trimmed = trimShortMemoryTurns(turns);
    expect(trimmed).toHaveLength(SHORT_MEMORY_MAX_TURNS);
    expect(trimmed[0]?.content.length).toBeLessThanOrEqual(400);
  });

  it("drops empty or invalid turns", () => {
    const trimmed = trimShortMemoryTurns([
      { role: "user", content: "  hello  " },
      { role: "user", content: "   " },
      { role: "assistant", content: "ok" },
    ]);
    expect(trimmed).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "ok" },
    ]);
  });
});
