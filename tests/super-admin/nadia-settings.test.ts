import { describe, expect, it } from "vitest";
import {
  estimateNadiaQueryCostMyr,
  includesTextOutput,
  includesVoiceOutput,
  parseNadiaSettings,
} from "@/lib/super-admin/nadia-settings";

describe("nadia settings", () => {
  it("parses valid settings", () => {
    expect(
      parseNadiaSettings({
        reply_mode: "text_only",
        voice_auto_play: false,
      }),
    ).toEqual({ reply_mode: "text_only", voice_auto_play: false });
  });

  it("falls back to defaults on invalid input", () => {
    expect(parseNadiaSettings({ foo: 1 })).toEqual({
      reply_mode: "text_and_voice",
      voice_auto_play: true,
    });
  });

  it("detects output channels", () => {
    expect(includesVoiceOutput("text_only")).toBe(false);
    expect(includesVoiceOutput("voice_only")).toBe(true);
    expect(includesTextOutput("voice_only")).toBe(false);
    expect(includesTextOutput("text_and_voice")).toBe(true);
  });

  it("estimates lower cost for text_only", () => {
    const voice = estimateNadiaQueryCostMyr({ replyMode: "text_and_voice" });
    const text = estimateNadiaQueryCostMyr({ replyMode: "text_only" });
    expect(text).toBeLessThan(voice);
  });
});
