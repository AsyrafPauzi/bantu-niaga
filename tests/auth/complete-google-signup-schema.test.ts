import { describe, expect, it } from "vitest";
import { completeGoogleSignupSchema } from "@/lib/auth/schemas";

const valid = {
  business_name: "Nasi Lemak Berkat",
  state_code: "KUL",
  accept_terms: true as const,
  signup_path: "free" as const,
};

describe("completeGoogleSignupSchema", () => {
  it("accepts plan, business, state, and terms", () => {
    expect(completeGoogleSignupSchema.parse(valid)).toEqual({
      ...valid,
      signup_path: "free",
    });
  });

  it("defaults signup_path to free", () => {
    const { signup_path: _signupPath, ...rest } = valid;
    expect(completeGoogleSignupSchema.parse(rest).signup_path).toBe("free");
  });

  it("rejects extra keys including email and password", () => {
    const result = completeGoogleSignupSchema.safeParse({
      ...valid,
      email: "attacker@example.test",
      password: "HackedPass1x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects accept_terms false", () => {
    expect(
      completeGoogleSignupSchema.safeParse({ ...valid, accept_terms: false })
        .success,
    ).toBe(false);
  });

  it("rejects short business_name", () => {
    expect(
      completeGoogleSignupSchema.safeParse({ ...valid, business_name: "A" })
        .success,
    ).toBe(false);
  });
});
