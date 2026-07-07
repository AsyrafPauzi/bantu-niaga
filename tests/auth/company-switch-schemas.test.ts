import { describe, expect, it } from "vitest";
import { addBusinessSchema, switchBusinessSchema } from "@/lib/auth/schemas";

describe("switchBusinessSchema", () => {
  it("accepts a valid business uuid", () => {
    const parsed = switchBusinessSchema.parse({
      business_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(parsed.business_id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid ids", () => {
    expect(() =>
      switchBusinessSchema.parse({ business_id: "not-a-uuid" }),
    ).toThrow();
  });
});

describe("addBusinessSchema", () => {
  it("requires password and terms", () => {
    expect(() =>
      addBusinessSchema.parse({
        password: "",
        business_name: "A",
        accept_terms: true,
      }),
    ).toThrow();

    expect(() =>
      addBusinessSchema.parse({
        password: "secret",
        business_name: "A",
        accept_terms: false,
      }),
    ).toThrow();
  });
});
