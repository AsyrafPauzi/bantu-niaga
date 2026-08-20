import { NextResponse } from "next/server";
import { SubscriptionPastDueError } from "@/lib/settings/subscription-writable";

export function pastDueJsonResponse(err: SubscriptionPastDueError) {
  return NextResponse.json(
    { error: err.code, message: err.message },
    { status: 402 },
  );
}
