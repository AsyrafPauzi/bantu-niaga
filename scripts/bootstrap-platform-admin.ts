/**
 * Bantu Niaga — bootstrap a platform admin.
 *
 * Creates an `auth.users` row + `public.platform_admins` row for the
 * given email. Use it once to create the first admin (the in-app
 * "Invite admin" UI requires you to already BE an admin), and any
 * time afterwards via the UI is preferred.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-platform-admin.ts \
 *     --email admin@example.com \
 *     --password 'StrongPasswordHere' \
 *     --name 'Platform Admin'
 *
 * Or set env vars:
 *   BOOTSTRAP_ADMIN_EMAIL=…  BOOTSTRAP_ADMIN_PASSWORD=…  BOOTSTRAP_ADMIN_NAME=…
 *
 * Idempotent:
 *   - If auth user exists, re-uses it and updates password.
 *   - If platform_admins row exists, skips insert; un-revokes if needed.
 *
 * Requires `.env.local` to contain `NEXT_PUBLIC_SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY`.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ──────────────── env loading (no dotenv dep) ──────────────── */

function loadDotEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnvLocal();

/* ──────────────── arg parsing ──────────────── */

function parseArgs(argv: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const email =
  args.email ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "";
const password =
  args.password ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
const displayName =
  args.name ??
  process.env.BOOTSTRAP_ADMIN_NAME ??
  "Platform Admin";

if (!email || !password) {
  console.error(
    "Missing --email and/or --password (or BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD).",
  );
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.",
  );
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ──────────────── helpers ──────────────── */

async function findAuthUserByEmail(
  targetEmail: string,
): Promise<{ id: string; email: string | null } | null> {
  // listUsers paginates; for a single lookup the first page is enough
  // unless the project has hundreds of users — fine for bootstrap.
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
    const hit = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === targetEmail.toLowerCase(),
    );
    if (hit) return { id: hit.id, email: hit.email ?? null };
    if (data.users.length < 200) return null;
    page += 1;
  }
}

/* ──────────────── main ──────────────── */

async function main(): Promise<void> {
  console.log(`[bootstrap] target email=${email} name="${displayName}"`);

  /* 1. auth.users — create or update password */
  let userId: string;
  const existing = await findAuthUserByEmail(email);
  if (existing) {
    userId = existing.id;
    console.log(`[bootstrap] auth user already exists (id=${userId})`);
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) {
      throw new Error(`auth.admin.updateUserById: ${error.message}`);
    }
    console.log(`[bootstrap] auth user password reset`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, source: "bootstrap" },
    });
    if (error || !data.user) {
      throw new Error(
        `auth.admin.createUser: ${error?.message ?? "no user returned"}`,
      );
    }
    userId = data.user.id;
    console.log(`[bootstrap] auth user created (id=${userId})`);
  }

  /* 2. public.platform_admins — insert or un-revoke */
  const { data: existingRow, error: selectErr } = await supabase
    .from("platform_admins")
    .select("id, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectErr) {
    throw new Error(`select platform_admins: ${selectErr.message}`);
  }

  if (existingRow) {
    if (existingRow.revoked_at) {
      const { error } = await supabase
        .from("platform_admins")
        .update({
          revoked_at: null,
          display_name: displayName,
          email,
        })
        .eq("id", existingRow.id);
      if (error) {
        throw new Error(`un-revoke platform_admins: ${error.message}`);
      }
      console.log(`[bootstrap] platform_admins row un-revoked`);
    } else {
      console.log(`[bootstrap] platform_admins row already active — no change`);
    }
  } else {
    const { error } = await supabase.from("platform_admins").insert({
      user_id: userId,
      email,
      display_name: displayName,
      notes: "Created via scripts/bootstrap-platform-admin.ts",
    });
    if (error) {
      throw new Error(`insert platform_admins: ${error.message}`);
    }
    console.log(`[bootstrap] platform_admins row inserted`);
  }

  console.log("[bootstrap] done.");
  console.log("");
  console.log("Sign in at /sign-in then visit /super-admin.");
}

main().catch((err) => {
  console.error("[bootstrap] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
