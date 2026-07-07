import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    bundle_id: z.string().min(2).max(80),
  })
  .strict();

/**
 * POST /api/marketplace/activate-bundle
 *
 * Phase 2 — one-click bundle activation with ~15% add-on discount.
 * Not implemented yet; Phase 1 uses step-by-step plan + add-on activation.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }

  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "forbidden", message: "Only the owner can activate bundles." },
      { status: 403 },
    );
  }

  try {
    schema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: "not_implemented",
      message:
        "One-click bundle activation ships in Phase 2. Use the recommendation page to activate your plan and add-ons step by step for now.",
      phase: 2,
    },
    { status: 501 },
  );
}
