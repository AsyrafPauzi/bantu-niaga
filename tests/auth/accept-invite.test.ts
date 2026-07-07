import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/accept-invite/route";

describe("POST /api/auth/accept-invite", () => {
  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
  });

});
