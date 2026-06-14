import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/marketplace/load";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const entries = await loadCatalog();
    return NextResponse.json({ entries }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "load_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
