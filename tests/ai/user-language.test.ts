import { describe, expect, it } from "vitest";
import {
  detectUserLanguage,
  userLanguageInstruction,
} from "@/lib/ai/user-language";

describe("detectUserLanguage", () => {
  it("detects Tamil script", () => {
    expect(detectUserLanguage("இன்வாய்ஸ் எது unpaid?")).toBe("tamil");
  });

  it("detects Simplified Mandarin", () => {
    expect(detectUserLanguage("帮我看一下现金流")).toBe("mandarin_simplified");
  });

  it("detects Traditional Mandarin", () => {
    expect(detectUserLanguage("請問這個月的報表在哪裡？")).toBe(
      "mandarin_traditional",
    );
  });

  it("detects Cantonese markers", () => {
    expect(detectUserLanguage("唔該幫我睇下發票")).toBe("cantonese");
  });

  it("detects Kelantan dialect markers", () => {
    expect(detectUserLanguage("demo boleh tengok invois tak bayar?")).toBe(
      "bahasa_kelantan",
    );
  });

  it("detects Terengganu dialect markers", () => {
    expect(detectUserLanguage("mung boleh tengok pitih bulan ni?")).toBe(
      "bahasa_terengganu",
    );
  });

  it("detects Sarawak dialect markers", () => {
    expect(detectUserLanguage("kamek nak tengok invois kitak")).toBe(
      "bahasa_sarawak",
    );
  });

  it("detects standard Bahasa Malaysia", () => {
    expect(detectUserLanguage("tolong semak perbelanjaan bulan ini")).toBe(
      "bahasa_malaysia",
    );
  });

  it("defaults to English", () => {
    expect(detectUserLanguage("What invoices are unpaid?")).toBe("english");
  });
});

describe("userLanguageInstruction", () => {
  it("returns Tamil instruction for Tamil", () => {
    expect(userLanguageInstruction("tamil")).toContain("Tamil");
  });

  it("returns Kelantan instruction for Kelantan", () => {
    expect(userLanguageInstruction("bahasa_kelantan")).toContain("Kelantan");
  });

  it("returns Sabah instruction for Sabah", () => {
    expect(userLanguageInstruction("bahasa_sabah")).toContain("Sabah");
  });
});
