/**
 * Seed dummy Admin Storage files and link compliance licences to uploads.
 *
 * Usage:
 *   npm run seed:storage
 *   npm run seed:storage -- --fresh   # remove prior demo-seed files first
 *
 * Env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SEED_OWNER_EMAIL (optional — defaults to demo owner)
 */
import {
  createServiceAdmin,
  DEFAULT_OWNER_EMAIL,
  loadDotEnvLocal,
} from "./lib/demo-env";
import {
  purgeDemoStorageSeed,
  seedAdminStorage,
} from "./lib/seed-admin-storage";

async function resolveOwner(admin: ReturnType<typeof createServiceAdmin>) {
  const email = process.env.SEED_OWNER_EMAIL ?? DEFAULT_OWNER_EMAIL;
  const { data, error } = await admin
    .from("users")
    .select("id, business_id, email")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(`Owner ${email} not found — run: npm run seed`);
  }
  return {
    userId: data.id as string,
    businessId: data.business_id as string,
    email: data.email as string,
  };
}

async function main(): Promise<void> {
  loadDotEnvLocal();
  const fresh = process.argv.includes("--fresh");
  const admin = createServiceAdmin();
  const owner = await resolveOwner(admin);

  console.log("\n=== Seed Admin Storage (demo files) ===\n");
  console.log(`Business: ${owner.businessId}`);
  console.log(`Owner:    ${owner.email}`);

  if (fresh) {
    const removed = await purgeDemoStorageSeed(admin, owner.businessId);
    console.log(`[fresh] removed ${removed} prior demo-seed file(s)`);
  }

  const result = await seedAdminStorage(admin, owner.businessId, owner.userId);

  console.log(`\n[done] ${result.files} files uploaded`);
  console.log(`       ${result.complianceLinked} compliance licences linked`);
  console.log("\nOpen: http://localhost:3000/admin/storage");
  console.log("      http://localhost:3000/admin/compliance\n");
}

main().catch((err) => {
  console.error(
    "\n[seed:storage] failed:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
