import { describe, expect, it } from "vitest";
import { resolveGoogleCallbackTarget } from "@/lib/auth/google-callback";

const uid = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";

describe("resolveGoogleCallbackTarget", () => {
  it("continues when a profile exists for this auth user", () => {
    expect(
      resolveGoogleCallbackTarget({
        authUserId: uid,
        profileId: uid,
        emailOwnerId: uid,
        nextPath: "/home",
      }),
    ).toEqual({ kind: "continue", nextPath: "/home" });
  });

  it("sends new Google users to complete", () => {
    expect(
      resolveGoogleCallbackTarget({
        authUserId: uid,
        profileId: null,
        emailOwnerId: null,
        nextPath: "/home",
      }),
    ).toEqual({ kind: "complete" });
  });

  it("blocks when the email belongs to a different profile", () => {
    expect(
      resolveGoogleCallbackTarget({
        authUserId: uid,
        profileId: null,
        emailOwnerId: other,
        nextPath: "/home",
      }),
    ).toEqual({ kind: "email_taken" });
  });
});
