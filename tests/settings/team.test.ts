import { describe, expect, it } from "vitest";
import { teamInviteSchema, teamMemberRoleSchema } from "@/lib/settings/schemas";

describe("teamInviteSchema", () => {
  it("accepts a valid invite", () => {
    const parsed = teamInviteSchema.parse({
      email: "staff@example.com",
      role: "cashier",
      display_name: "Aina",
    });
    expect(parsed.email).toBe("staff@example.com");
    expect(parsed.role).toBe("cashier");
  });

  it("rejects owner role on invite", () => {
    expect(() =>
      teamInviteSchema.parse({
        email: "x@y.com",
        role: "owner",
      }),
    ).toThrow();
  });
});

describe("teamMemberRoleSchema", () => {
  it("accepts staff role change", () => {
    expect(teamMemberRoleSchema.parse({ role: "staff" }).role).toBe("staff");
  });
});
