import { describe, expect, it } from "vitest";
import { normalizeMyPhone } from "@/lib/marketing/phone";

describe("normalizeMyPhone — Malaysian + international E.164", () => {
  it("normalizes a local mobile starting with 0", () => {
    expect(normalizeMyPhone("0123456789")).toBe("+60123456789");
  });

  it("normalizes a local mobile with dashes", () => {
    expect(normalizeMyPhone("012-345 6789")).toBe("+60123456789");
  });

  it("normalizes a local mobile with parentheses and spaces", () => {
    expect(normalizeMyPhone(" (012) 345-6789 ")).toBe("+60123456789");
  });

  it("normalizes a 60-prefixed local mobile", () => {
    expect(normalizeMyPhone("60123456789")).toBe("+60123456789");
  });

  it("accepts a +60-prefixed local mobile as-is", () => {
    expect(normalizeMyPhone("+60123456789")).toBe("+60123456789");
  });

  it("accepts a foreign +65 (Singapore) number as-is", () => {
    expect(normalizeMyPhone("+6591234567")).toBe("+6591234567");
  });

  it("accepts a +1 US number with formatting", () => {
    expect(normalizeMyPhone("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("handles a 9-digit Malaysian fixed-line starting with 0", () => {
    expect(normalizeMyPhone("0312345678")).toBe("+60312345678");
  });

  it("rejects empty string", () => {
    expect(normalizeMyPhone("")).toBeNull();
  });

  it("rejects only whitespace", () => {
    expect(normalizeMyPhone("   ")).toBeNull();
  });

  it("rejects null input", () => {
    expect(normalizeMyPhone(null)).toBeNull();
  });

  it("rejects undefined input", () => {
    expect(normalizeMyPhone(undefined)).toBeNull();
  });

  it("rejects an unparseable bare 7-digit number (no country prefix)", () => {
    expect(normalizeMyPhone("1234567")).toBeNull();
  });

  it("rejects alphabetic garbage", () => {
    expect(normalizeMyPhone("call me later")).toBeNull();
  });

  it("rejects a too-long number (>15 digits)", () => {
    expect(normalizeMyPhone("+1234567890123456")).toBeNull();
  });

  it("rejects a too-short E.164 (<8 digits)", () => {
    expect(normalizeMyPhone("+1234567")).toBeNull();
  });

  it("normalizes leading +60 with separators", () => {
    expect(normalizeMyPhone("+60-12-345-6789")).toBe("+60123456789");
  });

  it("rejects a 0-prefixed number that is too short", () => {
    expect(normalizeMyPhone("012345")).toBeNull();
  });
});
