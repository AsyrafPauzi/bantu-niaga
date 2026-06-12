import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/marketing/customers/csv-import/[id]/commit — Marketing M3.
 *
 * Reads the cached preview from `customer_csv_imports.preview` and
 * passes it to `marketing_csv_commit(p_business_id, p_user_id,
 * p_import_id, p_rows)`. That RPC is a single atomic Postgres
 * transaction:
 *
 *   - inserts every row in `preview.created` into `customers`
 *   - appends one `customer.created` row to `events_outbox` per insert
 *   - stamps the import row `status='committed', committed_at=now()`
 *
 * If any insert fails (e.g. a phone-uniqueness race), the whole
 * transaction rolls back and the import row stays at status='previewed'
 * so the operator can fix and retry.
 *
 * Idempotency: the RPC raises 'already_committed' if `committed_at` is
 * already set; the route maps that to 409.
 *
 * Returns:
 *   { created, merged, rejected, total, created_customer_ids[] }
 *
 * Errors:
 *   401 — no session
 *   403 — wrong role
 *   404 — import row not found / cross-business
 *   409 — already committed
 *   410 — import preview expired (>24h since preview ran)
 *   422 — no preview cached (operator skipped the preview phase)
 *   500 — RPC error (atomic rollback applied)
 */

export const dynamic = "force-dynamic";

interface ImportRow {
  id: string;
  business_id: string;
  committed_at: string | null;
  expires_at: string;
  status: string;
  preview: unknown;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
  if (!canSurface(user.role, "marketing", "customers")) {
    return NextResponse.json(
      { error: "forbidden", reason: "marketing.csv_import access denied" },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: imp, error: loadErr } = await supabase
    .from("customer_csv_imports")
    .select("id, business_id, committed_at, expires_at, status, preview")
    .eq("id", id)
    .eq("business_id", user.businessId)
    .maybeSingle<ImportRow>();

  if (loadErr) {
    return NextResponse.json(
      { error: "load_failed", message: loadErr.message },
      { status: 500 },
    );
  }
  if (!imp) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (imp.committed_at) {
    return NextResponse.json(
      {
        error: "already_committed",
        message: "This import was already committed.",
        committed_at: imp.committed_at,
      },
      { status: 409 },
    );
  }
  if (new Date(imp.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      {
        error: "expired",
        message: "This import expired (24h retention). Re-upload and retry.",
      },
      { status: 410 },
    );
  }
  if (imp.preview === null || imp.preview === undefined) {
    return NextResponse.json(
      {
        error: "no_preview",
        message: "Preview not cached. Call /preview first.",
      },
      { status: 422 },
    );
  }

  const { data, error: rpcErr } = await supabase.rpc("marketing_csv_commit", {
    p_business_id: user.businessId,
    p_user_id: user.id,
    p_import_id: id,
    p_rows: imp.preview,
  });

  if (rpcErr) {
    if (rpcErr.code === "P0001") {
      if (rpcErr.message === "already_committed") {
        return NextResponse.json(
          { error: "already_committed" },
          { status: 409 },
        );
      }
      if (rpcErr.message === "expired") {
        return NextResponse.json({ error: "expired" }, { status: 410 });
      }
      if (rpcErr.message === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
    }
    return NextResponse.json(
      {
        error: "commit_failed",
        message: rpcErr.message,
        code: rpcErr.code ?? null,
      },
      { status: 500 },
    );
  }

  const row = Array.isArray(data)
    ? (data[0] as
        | {
            created_count?: number;
            merged_count?: number;
            rejected_count?: number;
            total_count?: number;
            created_customer_ids?: string[];
          }
        | undefined)
    : (data as
        | {
            created_count?: number;
            merged_count?: number;
            rejected_count?: number;
            total_count?: number;
            created_customer_ids?: string[];
          }
        | null);

  return NextResponse.json(
    {
      action: "committed",
      import_id: id,
      created: row?.created_count ?? 0,
      merged: row?.merged_count ?? 0,
      rejected: row?.rejected_count ?? 0,
      total: row?.total_count ?? 0,
      created_customer_ids: row?.created_customer_ids ?? [],
    },
    { status: 200 },
  );
}
