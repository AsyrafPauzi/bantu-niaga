import { PDFDocument, rgb } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminFileCategory } from "../../lib/admin/schemas";
import { daysAgoIso, daysFromNowYmd, demoUuid } from "./demo-env";

const STORAGE_BUCKET = "admin-files";
export const DEMO_STORAGE_SEED_TAG = "demo-seed";

interface SeedFileSpec {
  idBlock: string;
  seq: number;
  fileName: string;
  category: AdminFileCategory;
  mimeType: string;
  makeBytes: () => Promise<Uint8Array>;
  description: string;
  complianceTitle?: string;
  createdDaysAgo?: number;
}

function oneByOnePng(): Uint8Array {
  return Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
}

async function makeDemoPdf(title: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 300]);
  page.drawText(title, { x: 40, y: 200, size: 18, color: rgb(0.15, 0.2, 0.45) });
  page.drawText("Bantu Niaga — demo document", {
    x: 40,
    y: 165,
    size: 12,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText("Safe to delete. Seeded for UI preview.", {
    x: 40,
    y: 140,
    size: 10,
    color: rgb(0.5, 0.5, 0.5),
  });
  return pdf.save();
}

const SEED_FILE_SPECS: SeedFileSpec[] = [
  {
    idBlock: "f7000301",
    seq: 1,
    fileName: "SSM-Certificate-2026.pdf",
    category: "compliance",
    mimeType: "application/pdf",
    makeBytes: () => makeDemoPdf("SSM Business Registration"),
    description: "Demo SSM certificate scan",
    complianceTitle: "SSM Business Registration",
    createdDaysAgo: 42,
  },
  {
    idBlock: "f7000301",
    seq: 2,
    fileName: "DBKL-Signboard-Permit.pdf",
    category: "compliance",
    mimeType: "application/pdf",
    makeBytes: () => makeDemoPdf("DBKL Signboard Licence"),
    description: "Demo signboard permit",
    complianceTitle: "DBKL Signboard Licence",
    createdDaysAgo: 35,
  },
  {
    idBlock: "f7000301",
    seq: 3,
    fileName: "Halal-Certificate.png",
    category: "compliance",
    mimeType: "image/png",
    makeBytes: async () => oneByOnePng(),
    description: "Demo halal certificate image",
    complianceTitle: "Halal Certificate",
    createdDaysAgo: 28,
  },
  {
    idBlock: "f7000301",
    seq: 4,
    fileName: "Insurance-Policy-2026.pdf",
    category: "compliance",
    mimeType: "application/pdf",
    makeBytes: () => makeDemoPdf("Public Liability Insurance"),
    description: "Demo insurance policy PDF",
    complianceTitle: "Public Liability Insurance",
    createdDaysAgo: 21,
  },
  {
    idBlock: "f7000301",
    seq: 5,
    fileName: "Supplier-Agreement-Rice.pdf",
    category: "contract",
    mimeType: "application/pdf",
    makeBytes: () => makeDemoPdf("Supplier agreement — rice"),
    description: "Demo supplier contract",
    createdDaysAgo: 18,
  },
  {
    idBlock: "f7000301",
    seq: 6,
    fileName: "Receipt-Jan-Catering.pdf",
    category: "receipt",
    mimeType: "application/pdf",
    makeBytes: () => makeDemoPdf("Catering receipt — January"),
    description: "Demo catering receipt",
    createdDaysAgo: 14,
  },
  {
    idBlock: "f7000301",
    seq: 7,
    fileName: "Receipt-Feb-Utilities.png",
    category: "receipt",
    mimeType: "image/png",
    makeBytes: async () => oneByOnePng(),
    description: "Demo utilities receipt scan",
    createdDaysAgo: 9,
  },
  {
    idBlock: "f7000301",
    seq: 8,
    fileName: "Signed-Ad-Contract.pdf",
    category: "marketing",
    mimeType: "application/pdf",
    makeBytes: () => makeDemoPdf("Signed ad contract"),
    description: "Demo signed marketing contract",
    createdDaysAgo: 6,
  },
];

const COMPLIANCE_SEED = [
  { title: "SSM Business Registration", category: "ssm", days: 45 },
  { title: "DBKL Signboard Licence", category: "dbkl", days: 90 },
  { title: "Halal Certificate", category: "halal", days: 120 },
  { title: "Public Liability Insurance", category: "insurance", days: 200 },
];

export async function purgeDemoStorageSeed(
  admin: SupabaseClient,
  businessId: string,
): Promise<number> {
  const { data: existing, error } = await admin
    .from("admin_files")
    .select("id, storage_path")
    .eq("business_id", businessId)
    .contains("tags", [DEMO_STORAGE_SEED_TAG])
    .is("deleted_at", null);

  if (error) throw new Error(`purge demo storage: ${error.message}`);
  if (!existing?.length) return 0;

  const ids = existing.map((row) => row.id as string);
  const paths = existing.map((row) => row.storage_path as string);

  await admin
    .from("admin_compliance_items")
    .update({ admin_file_id: null })
    .eq("business_id", businessId)
    .in("admin_file_id", ids);

  await admin.storage.from(STORAGE_BUCKET).remove(paths);

  const { error: delErr } = await admin.from("admin_files").delete().in("id", ids);
  if (delErr) throw new Error(`purge admin_files: ${delErr.message}`);

  return ids.length;
}

async function ensureComplianceItems(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("admin_compliance_items")
    .select("title")
    .eq("business_id", businessId)
    .is("deleted_at", null);

  if (error) throw new Error(`compliance lookup: ${error.message}`);

  const existing = new Set((data ?? []).map((row) => row.title as string));
  const missing = COMPLIANCE_SEED.filter((c) => !existing.has(c.title));
  if (missing.length === 0) return;

  const rows = missing.map((c) => {
    const idx = COMPLIANCE_SEED.findIndex((x) => x.title === c.title);
    return {
      id: demoUuid("f7000100", idx + 1),
      business_id: businessId,
      title: c.title,
      category: c.category,
      authority: "Demo authority",
      reference_number: `REF-2026-${100 + idx}`,
      expires_on: daysFromNowYmd(c.days),
      status: "active",
      created_by: userId,
    };
  });

  const { error: insErr } = await admin.from("admin_compliance_items").insert(rows);
  if (insErr) throw new Error(`compliance insert: ${insErr.message}`);
}

async function seedOneFile(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
  spec: SeedFileSpec,
): Promise<string> {
  const bytes = await spec.makeBytes();
  const fileId = demoUuid(spec.idBlock, spec.seq);
  const folderId = demoUuid("f7000310", spec.seq);
  const storagePath = `${businessId}/${folderId}/${spec.fileName}`;

  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: spec.mimeType,
      upsert: true,
    });
  if (upErr) throw new Error(`storage upload ${spec.fileName}: ${upErr.message}`);

  const { error: insErr } = await admin.from("admin_files").insert({
    id: fileId,
    business_id: businessId,
    uploaded_by: userId,
    storage_path: storagePath,
    file_name: spec.fileName,
    mime_type: spec.mimeType,
    file_size_bytes: bytes.length,
    category: spec.category,
    description: spec.description,
    tags: [DEMO_STORAGE_SEED_TAG],
    created_at: daysAgoIso(spec.createdDaysAgo ?? 10),
  });
  if (insErr) throw new Error(`admin_files ${spec.fileName}: ${insErr.message}`);

  if (spec.complianceTitle) {
    const { error: linkErr } = await admin
      .from("admin_compliance_items")
      .update({ admin_file_id: fileId })
      .eq("business_id", businessId)
      .eq("title", spec.complianceTitle)
      .is("deleted_at", null);
    if (linkErr) throw new Error(`compliance link ${spec.fileName}: ${linkErr.message}`);
  }

  return fileId;
}

export async function seedAdminStorage(
  admin: SupabaseClient,
  businessId: string,
  userId: string,
): Promise<{ files: number; complianceLinked: number }> {
  await ensureComplianceItems(admin, businessId, userId);

  let complianceLinked = 0;
  for (const spec of SEED_FILE_SPECS) {
    await seedOneFile(admin, businessId, userId, spec);
    if (spec.complianceTitle) complianceLinked += 1;
  }

  return { files: SEED_FILE_SPECS.length, complianceLinked };
}
