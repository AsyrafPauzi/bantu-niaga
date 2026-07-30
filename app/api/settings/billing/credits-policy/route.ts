import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { loadCreditRolloverPolicy } from "@/lib/settings/credit-rollover";

export const dynamic = "force-dynamic";

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "unauthorized", code: e.code },
        { status: 401 },
      );
    }
    throw e;
  }

  try {
    const policy = await loadCreditRolloverPolicy(user.businessId);
    return NextResponse.json(policy, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        error: "policy_load_failed",
        message: e instanceof Error ? e.message : "Could not load credit policy",
      },
      { status: 500 },
    );
  }
}
