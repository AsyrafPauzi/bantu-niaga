import { describe, expect, it } from "vitest";
import {
  filterAvailableTeamMembers,
  suggestTeamMemberByEmail,
} from "@/lib/hr/link-login";

const members = [
  { id: "u1", email: "ali@example.com", display_name: "Ali" },
  { id: "u2", email: "siti@example.com", display_name: "Siti" },
  { id: "u3", email: null, display_name: "No Email" },
];

describe("suggestTeamMemberByEmail", () => {
  it("matches email case-insensitively when not taken", () => {
    expect(
      suggestTeamMemberByEmail("ALI@example.com", members, new Set()),
    ).toBe("u1");
  });

  it("skips members already linked elsewhere", () => {
    expect(
      suggestTeamMemberByEmail("ali@example.com", members, new Set(["u1"])),
    ).toBeNull();
  });

  it("returns null when no email", () => {
    expect(suggestTeamMemberByEmail(null, members, new Set())).toBeNull();
  });
});

describe("filterAvailableTeamMembers", () => {
  it("keeps the currently linked user even if marked taken", () => {
    const available = filterAvailableTeamMembers(
      members,
      new Set(["u1", "u2"]),
      "u1",
    );
    expect(available.map((m) => m.id)).toEqual(["u1", "u3"]);
  });
});
