import { describe, expect, it } from "vitest";
import {
  locationFromIp,
  parseClientIp,
  parseUserAgent,
} from "@/lib/auth/device";

describe("parseUserAgent", () => {
  it("detects Mac Chrome", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe("Mac · Chrome");
  });

  it("detects iPhone", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
      ),
    ).toBe("iPhone · Safari");
  });
});

describe("parseClientIp", () => {
  it("uses first forwarded IP", () => {
    expect(parseClientIp("203.0.113.1, 10.0.0.1", null)).toBe("203.0.113.1");
  });

  it("falls back to real IP", () => {
    expect(parseClientIp(null, "192.168.1.1")).toBe("192.168.1.1");
  });
});

describe("locationFromIp", () => {
  it("returns Malaysia placeholder", () => {
    expect(locationFromIp("203.0.113.1")).toBe("Malaysia");
  });
});
