import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { canSurface } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * POST /api/marketing/customers/csv-import — Marketing M3 upload phase.
 *
 * Multipart form-data; single `file` field. The handler:
 *   1. Authenticates + RBAC-gates (Owner/Manager only).
 *   2. Pulls the file blob from the request, enforces a 2 MB cap
 *      (spec §C) and an "extensionless or .csv only" sniff.
 *   3. Generates an `import_id` (uuid) and uploads the file via the
 *      service-role client to `csv-imports/<business_id>/<import_id>.csv`.
 *      Service-role is required because storage RLS otherwise refuses
 *      cross-bucket inserts from anonymous-feeling SSR sessions
 *      (the JWT-aware `current_business_id()` works for table policies
 *      but storage uses its own role assertion).
 *   4. Inserts a `customer_csv_imports` row with `status='uploaded'`,
 *      `file_size_bytes`, and a 24h `expires_at` default (the column
 *      default does that automatically).
 *
 * @returns 201 { import_id, file_size_bytes, uploaded_at } on success.
 *
 * Errors:
 *   401 — no session
 *   403 — wrong role
 *   400 — missing `file` field, empty file, oversized file, unreadable
 *   409 — another import is in-flight (status=uploaded|previewed) and
 *         hasn't been committed/expired (plan §8.6: 1 concurrent import)
 *   500 — storage or DB write failure
 */

export const dynamic = "force-dynamic";

/**
 * Hard cap on uploaded file size. Spec §C calls for 2 MB even though
 * the plan §8.6 said 5 MB; the spec is the most recent authoritative
 * doc. 2 MB is still comfortable for the 5,000-row Q7 cap (a row of
 * ~140 chars × 5,000 rows ≈ 700 KB).
 */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  // ── auth ──────────────────────────────────────────────────────────
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

  // ── parse multipart ───────────────────────────────────────────────
  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    return NextResponse.json(
      {
        error: "invalid_multipart",
        message: e instanceof Error ? e.message : "Could not parse upload.",
      },
      { status: 400 },
    );
  }
  const fileEntry = form.get("file");
  if (!(fileEntry instanceof Blob)) {
    return NextResponse.json(
      { error: "missing_file", message: "Form field `file` is required." },
      { status: 400 },
    );
  }
  const file = fileEntry as Blob & { name?: string };

  if (file.size === 0) {
    return NextResponse.json(
      { error: "empty_file", message: "Uploaded CSV is empty." },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: "file_too_large",
        message: `File is ${file.size} bytes; cap is ${MAX_FILE_BYTES} bytes (2 MB).`,
      },
      { status: 400 },
    );
  }

  // Optional originalName from the multipart filename — defensive,
  // fall back to a synthetic name. Browsers usually populate file.name
  // on FormData entries.
  const originalName =
    typeof file.name === "string" && file.name.length > 0
      ? file.name.slice(0, 240)
      : "import.csv";

  // ── one concurrent in-flight import per business (plan §8.6) ─────
  const supabase = await createSupabaseServerClient();
  const { data: inFlight, error: inFlightErr } = await supabase
    .from("customer_csv_imports")
    .select("id, status, created_at")
    .eq("business_id", user.businessId)
    .in("status", ["uploaded", "previewed"])
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (inFlightErr) {
    return NextResponse.json(
      { error: "load_failed", message: inFlightErr.message },
      { status: 500 },
    );
  }
  if (inFlight) {
    return NextResponse.json(
      {
        error: "import_in_flight",
        message: `Another import (${inFlight.id}) is still pending. Commit it or wait for it to expire before uploading another.`,
        in_flight_import_id: inFlight.id,
      },
      { status: 409 },
    );
  }

  // ── storage upload via service-role ──────────────────────────────
  const importId = randomUUID();
  const storagePath = `${user.businessId}/${importId}.csv`;

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (e) {
    return NextResponse.json(
      {
        error: "upload_read_failed",
        message: e instanceof Error ? e.message : "Could not read upload body.",
      },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  const { error: storeErr } = await admin.storage
    .from("csv-imports")
    .upload(storagePath, bytes, {
      contentType: "text/csv",
      upsert: false,
    });
  if (storeErr) {
    return NextResponse.json(
      { error: "storage_upload_failed", message: storeErr.message },
      { status: 500 },
    );
  }

  // ── DB row via the user's session (RLS-checked) ──────────────────
  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertErr } = await supabase
    .from("customer_csv_imports")
    .insert({
      id: importId,
      business_id: user.businessId,
      uploaded_by: user.id,
      storage_path: storagePath,
      original_name: originalName,
      status: "uploaded",
      file_size_bytes: file.size,
    })
    .select("id, created_at, expires_at, file_size_bytes")
    .single();

  if (insertErr) {
    // Best-effort cleanup of the orphaned storage object so reruns
    // don't accumulate unreferenced uploads.
    void admin.storage.from("csv-imports").remove([storagePath]);
    return NextResponse.json(
      { error: "insert_failed", message: insertErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      import_id: inserted.id,
      file_size_bytes: inserted.file_size_bytes ?? file.size,
      uploaded_at: inserted.created_at ?? nowIso,
      expires_at: inserted.expires_at,
    },
    { status: 201 },
  );
}
