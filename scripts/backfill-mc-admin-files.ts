/**
 * Backfill hr_leave_records.admin_file_id for legacy MC uploads (mc_document_path only).
 *
 * Usage:
 *   npm run backfill:mc-admin-files
 *   npm run backfill:mc-admin-files -- --dry-run
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadDotEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await admin
    .from("hr_leave_records")
    .select(
      "id, business_id, mc_document_path, mc_document_name, mc_document_mime, mc_document_size_bytes, requested_by",
    )
    .is("admin_file_id", null)
    .not("mc_document_path", "is", null);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(2);
  }

  const candidates = rows ?? [];
  console.log(`Found ${candidates.length} legacy MC row(s) to backfill.`);

  let updated = 0;
  let skipped = 0;

  for (const row of candidates) {
    const path = row.mc_document_path as string;
    const businessId = row.business_id as string;
    const segments = path.split("/");
    if (segments[0] !== businessId) {
      console.warn(`Skip ${row.id}: path tenant mismatch`);
      skipped += 1;
      continue;
    }

    const parentDir = segments.slice(0, -1).join("/");
    const baseName = segments[segments.length - 1];
    const { data: list, error: listErr } = await admin.storage
      .from("admin-files")
      .list(parentDir, { limit: 20, search: baseName });

    if (listErr || !(list ?? []).some((f) => f.name === baseName)) {
      console.warn(`Skip ${row.id}: storage object missing at ${path}`);
      skipped += 1;
      continue;
    }

    const fileName = (row.mc_document_name as string) || baseName;
    const mime = (row.mc_document_mime as string) || "application/octet-stream";
    const size = Number(row.mc_document_size_bytes ?? 0) || 1;
    const uploadedBy = (row.requested_by as string) || businessId;

    if (dryRun) {
      console.log(`[dry-run] would backfill ${row.id} → ${path}`);
      updated += 1;
      continue;
    }

    const { data: inserted, error: insErr } = await admin
      .from("admin_files")
      .insert({
        business_id: businessId,
        uploaded_by: uploadedBy,
        storage_path: path,
        file_name: fileName,
        mime_type: mime,
        file_size_bytes: size,
        category: "hr_doc",
        description: "Medical certificate (MC) — backfilled",
        tags: [],
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.warn(`Skip ${row.id}: admin_files insert failed — ${insErr?.message}`);
      skipped += 1;
      continue;
    }

    const { error: updErr } = await admin
      .from("hr_leave_records")
      .update({ admin_file_id: inserted.id })
      .eq("id", row.id);

    if (updErr) {
      console.warn(`Skip ${row.id}: leave update failed — ${updErr.message}`);
      skipped += 1;
      continue;
    }

    updated += 1;
    console.log(`Backfilled ${row.id} → admin_file ${inserted.id}`);
  }

  console.log(`Done. updated=${updated} skipped=${skipped} dryRun=${dryRun}`);
  process.exit(skipped > 0 && updated === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
