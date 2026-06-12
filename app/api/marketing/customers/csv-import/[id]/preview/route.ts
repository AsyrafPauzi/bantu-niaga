import { NextResponse } from "next/server";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseCsv, CsvParseFatal } from "@/lib/marketing/csv";
import { normalizeMyPhone } from "@/lib/marketing/phone";
import {
  classifyRow,
  summarize,
  type PreviewRowOutcome,
  type DedupCheck,
} from "@/lib/marketing/csv-classify";
import { CSV_MAX_ROWS } from "@/lib/marketing/schemas";

/**
 * GET /api/marketing/customers/csv-import/[id]/preview — Marketing M3
 * dry-run.
 *
 * Returns a categorized preview (created / merged / rejected) without
 * mutating the customer table. Re-runnable while the import is still
 * fresh (status='uploaded' or 'previewed' AND expires_at > now()).
 *
 * Flow:
 *   1. Auth + RBAC (Owner/Manager).
 *   2. Load the import row; 404 if missing / cross-business.
 *   3. 410 if expired (Q9 retention = 24h); 409 if already committed.
 *   4. Fetch the file from Supabase Storage via service-role.
 *   5. Parse with `parseCsv`. Cap at 5,000 rows (Q7) → 422 if exceeded.
 *   6. Batch-look-up existing live customers by normalized phone in
 *      ONE round trip (avoids 5k sequential queries).
 *   7. Classify each row via the pure `classifyRow` helper.
 *   8. Cache `{ summary, created, merged, rejected }` into the row's
 *      `preview` JSONB column + bump `status` to 'previewed' + reset
 *      `expires_at = now() + 24h` so the operator has a fresh window
 *      to confirm.
 *   9. Return the preview JSON.
 *
 * The preview JSON shape mirrors plan §8.4:
 *   {
 *     summary: { total, created, merged, rejected },
 *     created:  [ CreateOutcome, ... ],
 *     merged:   [ MergeOutcome, ... ],
 *     rejected: [ RejectOutcome, ... ],
 *     parse_errors: [ { row_number, reason } ]
 *   }
 */

export const dynamic = "force-dynamic";

interface ImportRow {
  id: string;
  business_id: string;
  storage_path: string;
  committed_at: string | null;
  expires_at: string;
  status: string;
  preview: unknown;
}

export async function GET(
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
    .select(
      "id, business_id, storage_path, committed_at, expires_at, status, preview",
    )
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
        message: "This import has already been committed.",
        committed_at: imp.committed_at,
      },
      { status: 409 },
    );
  }
  if (new Date(imp.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      {
        error: "expired",
        message:
          "This import has expired (24h retention). Re-upload the file to start over.",
      },
      { status: 410 },
    );
  }

  // ── pull file from storage ───────────────────────────────────────
  const admin = createServiceRoleClient();
  const { data: fileBlob, error: dlErr } = await admin.storage
    .from("csv-imports")
    .download(imp.storage_path);
  if (dlErr || !fileBlob) {
    return NextResponse.json(
      {
        error: "storage_download_failed",
        message: dlErr?.message ?? "Could not download CSV from storage.",
      },
      { status: 500 },
    );
  }
  const text = await fileBlob.text();

  // ── parse ────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = parseCsv(text);
  } catch (e) {
    return NextResponse.json(
      {
        error: "parse_fatal",
        message:
          e instanceof CsvParseFatal
            ? e.message
            : e instanceof Error
              ? e.message
              : "Could not parse CSV.",
      },
      { status: 422 },
    );
  }

  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    // Header-level error — return a useful 422 instead of an empty
    // preview the user would have to puzzle over.
    return NextResponse.json(
      {
        error: "invalid_header",
        message: parsed.errors[0].reason,
        parse_errors: parsed.errors,
      },
      { status: 422 },
    );
  }

  if (parsed.rows.length > CSV_MAX_ROWS) {
    return NextResponse.json(
      {
        error: "too_many_rows",
        message: `CSV has ${parsed.rows.length} rows; v1 cap is ${CSV_MAX_ROWS}. Split the file and re-upload.`,
        total_rows: parsed.rows.length,
        max_rows: CSV_MAX_ROWS,
      },
      { status: 422 },
    );
  }

  // ── normalize phones up front so we can batch the dedup lookup ──
  const normalized: Array<string | null> = parsed.rows.map((r) =>
    r.phone ? normalizeMyPhone(r.phone) : null,
  );
  const uniquePhones = Array.from(
    new Set(normalized.filter((p): p is string => p !== null)),
  );

  let lookup = new Map<string, DedupCheck>();
  if (uniquePhones.length > 0) {
    // Service-role lookup so the dedup sees merged/deleted rows too —
    // we filter them out client-side. The SSR client would do the same
    // (RLS hides them) but service-role is one less network hop than
    // setting up the user-bound builder.
    const { data: existing, error: lkErr } = await admin
      .from("customers")
      .select("id, name, phone_e164")
      .eq("business_id", user.businessId)
      .in("phone_e164", uniquePhones)
      .is("merged_into_id", null)
      .is("deleted_at", null);
    if (lkErr) {
      return NextResponse.json(
        { error: "dedup_lookup_failed", message: lkErr.message },
        { status: 500 },
      );
    }
    for (const row of existing ?? []) {
      const phone = row.phone_e164 as string | null;
      if (!phone) continue;
      lookup.set(phone, { id: row.id as string, name: row.name as string });
    }
  }

  // ── classify ────────────────────────────────────────────────────
  const ctx = { seenPhones: new Set<string>() };
  const outcomes: PreviewRowOutcome[] = parsed.rows.map((row, i) =>
    classifyRow(row, normalized[i], lookup.get(normalized[i] ?? "") ?? null, ctx),
  );

  const summary = summarize(outcomes);

  const previewJson = {
    summary,
    created: outcomes.filter((o) => o.action === "create"),
    merged: outcomes.filter((o) => o.action === "merge"),
    rejected: outcomes.filter((o) => o.action === "reject"),
    parse_errors: parsed.errors,
    delimiter: parsed.delimiter,
  };

  // ── cache on the import row (resets 24h window) ─────────────────
  const newExpiresIso = new Date(
    Date.now() + 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error: upErr } = await supabase
    .from("customer_csv_imports")
    .update({
      preview: previewJson,
      status: "previewed",
      row_count: parsed.rows.length,
      expires_at: newExpiresIso,
    })
    .eq("id", id)
    .eq("business_id", user.businessId);
  if (upErr) {
    // Soft failure — return the preview anyway, the operator can still
    // commit using the just-computed in-memory data (the commit endpoint
    // re-reads the cached preview, so an uncached run would 404 commit;
    // surface the cache error so the UI can warn).
    return NextResponse.json(
      {
        ...previewJson,
        cache_warning: upErr.message,
      },
      { status: 200 },
    );
  }

  return NextResponse.json(previewJson, { status: 200 });
}
