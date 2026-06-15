/**
 * Bantu Niaga — seed the demo owner.
 *
 * Idempotent. Run repeatedly without creating duplicates.
 *
 * Steps:
 *   1. Apply `supabase/seed.sql` (the demo businesses row).
 *   2. Ensure an `auth.users` row exists for the seed owner email; create
 *      it via the admin API if missing.
 *   3. Upsert a `public.users` row linking the auth user to the demo
 *      business with role='owner'.
 *
 * Env (with sensible defaults so a dev can run `npm run seed` with no
 * extra config):
 *   NEXT_PUBLIC_SUPABASE_URL       — required
 *   SUPABASE_SERVICE_ROLE_KEY      — required
 *   SEED_OWNER_EMAIL               — default: owner@demo.bantuniaga.local
 *   SEED_OWNER_PASSWORD            — default: DemoPassword!2026
 *   SEED_BUSINESS_ID               — default: 11111111-1111-1111-1111-111111111111
 *
 * Reads .env.local automatically (parsed manually so we don't need
 * dotenv as a dependency).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEMO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
const DEFAULT_EMAIL = "owner@demo.bantuniaga.local";
const DEFAULT_PASSWORD = "DemoPassword!2026";

function loadDotEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function findUserByEmail(
  adminClient: SupabaseClient,
  email: string,
): Promise<string | null> {
  let page = 1;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 50) return null;
  }
}

async function main(): Promise<void> {
  loadDotEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Set them in .env.local before running `npm run seed`.",
    );
  }

  const email = process.env.SEED_OWNER_EMAIL ?? DEFAULT_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD ?? DEFAULT_PASSWORD;
  const businessId = process.env.SEED_BUSINESS_ID ?? DEMO_BUSINESS_ID;

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log(`[seed] ensuring business ${businessId} (Bantu Niaga Demo SDN BHD)`);
  const { error: bizError } = await supabase
    .from("businesses")
    .upsert(
      {
        id: businessId,
        idcompany: "demo",
        name: "Bantu Niaga Demo SDN BHD",
        state_code: "KUL",
        tier: "enterprise",
      },
      { onConflict: "id" },
    );
  if (bizError) {
    throw new Error(`business upsert failed: ${bizError.message}`);
  }

  console.log(`[seed] ensuring auth user ${email}`);
  let userId = await findUserByEmail(supabase, email);
  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`auth user create failed: ${error.message}`);
    userId = data.user?.id ?? null;
    if (!userId) throw new Error("auth user create returned no id");
    console.log(`[seed]   created auth user ${userId}`);
  } else {
    console.log(`[seed]   reusing existing auth user ${userId}`);
    const { error: pwError } = await supabase.auth.admin.updateUserById(
      userId,
      { password, email_confirm: true },
    );
    if (pwError) {
      console.warn(
        `[seed]   password reset skipped (${pwError.message}); existing password still works.`,
      );
    }
  }

  console.log(`[seed] linking public.users row → business ${businessId} role=owner`);
  const { error: profileError } = await supabase.from("users").upsert(
    {
      id: userId,
      business_id: businessId,
      role: "owner",
      display_name: "Demo Owner",
      email,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    throw new Error(`public.users upsert failed: ${profileError.message}`);
  }

  console.log("[seed] done.");
  console.log("");
  console.log("Sign in at http://localhost:3000/sign-in");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
}

main().catch((err) => {
  console.error("[seed] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
