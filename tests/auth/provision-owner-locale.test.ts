import { describe, expect, it } from "vitest";
import { ownerProfileInsertPayload } from "@/lib/auth/provision-owner-business";

describe("ownerProfileInsertPayload", () => {
  it("includes preferred_locale from provision input", () => {
    expect(
      ownerProfileInsertPayload(
        {
          authUserId: "11111111-1111-1111-1111-111111111111",
          email: "owner@example.test",
          businessName: "Kedai Contoh",
          preferredLocale: "ms",
        },
        "biz-1",
      ),
    ).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      business_id: "biz-1",
      role: "owner",
      display_name: "Kedai Contoh",
      email: "owner@example.test",
      preferred_locale: "ms",
    });
  });
});
