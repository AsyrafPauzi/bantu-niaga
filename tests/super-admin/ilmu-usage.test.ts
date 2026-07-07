import { describe, expect, it } from "vitest";
import { resolveIlmuKeySource } from "@/lib/super-admin/ilmu-usage";

describe("resolveIlmuKeySource", () => {
  it("prefers enabled integration key over env", () => {
    expect(
      resolveIlmuKeySource({
        integrationEnabled: true,
        integrationKeyStored: true,
        envKeyConfigured: true,
      }),
    ).toBe("integration");
  });

  it("uses env when integration disabled or no stored key", () => {
    expect(
      resolveIlmuKeySource({
        integrationEnabled: false,
        integrationKeyStored: false,
        envKeyConfigured: true,
      }),
    ).toBe("env");
  });

  it("returns none when nothing configured", () => {
    expect(
      resolveIlmuKeySource({
        integrationEnabled: false,
        integrationKeyStored: false,
        envKeyConfigured: false,
      }),
    ).toBe("none");
  });
});
