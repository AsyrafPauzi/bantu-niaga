# Sign-up Language Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require English or Bahasa Melayu at email and Google sign-up, save it on `public.users.preferred_locale`, and send Auth mail (plus Boardroom digest chrome) in that language.

**Architecture:** Reuse the existing `en` | `ms` column and Settings Appearance picker. Both sign-up APIs require `preferred_locale`. Provision writes the column. Auth `user_metadata.preferred_locale` is a hint so confirm-email can be Malay if the Send Email hook fires before the profile row exists. App UI stays English.

**Tech Stack:** Next.js 15 App Router, Zod, Vitest, existing `lib/email/` renderer, Supabase Auth admin metadata.

**Spec:** `docs/superpowers/specs/2026-08-19-signup-language-preference-design.md`

## Global Constraints

- Locales are only `en` and `ms`. Any other string → `en`.
- Sign-up must pick a language; no pre-selected card; no `Accept-Language` inference.
- Source of truth is `public.users.preferred_locale`. `user_metadata.preferred_locale` is a hint only — never for authorization, RLS, or middleware.
- Zod `.strict()` on sign-up bodies. No client-supplied user id.
- Do not translate in-app UI, `/sign-up/guide`, invoices to customers, or marketing broadcasts.
- Boardroom digest **body** stays English; only `html lang`, CTA, and footer follow owner locale.
- Invitees without a profile → English.
- Idempotent Google complete (profile already exists) does not change locale.
- Tests stub Resend; never call the live API in CI.
- Commits only when the user asks, unless they chose an execution mode that includes commits.

## File map

| File | Role |
|------|------|
| `lib/auth/schemas.ts` | Required `preferred_locale` on email + Google complete schemas |
| `lib/email/resolve-locale.ts` | Profile first, then metadata hint, else `en` |
| `lib/auth/provision-owner-business.ts` | Insert `preferred_locale` on `public.users` |
| `app/api/auth/sign-up/route.ts` | Metadata hint + provision input |
| `app/api/auth/complete-google-signup/route.ts` | Provision input + admin metadata update |
| `app/api/webhooks/auth-send-email/route.ts` | Pass metadata hint into resolver |
| `lib/email/copy.ts` | Digest CTA/footer EN/MS |
| `app/api/cron/boardroom-weekly-digest/route.ts` | Owner locale for chrome |
| `components/auth/SignupLanguageCards.tsx` | Local-state language cards |
| `app/sign-up/page.tsx` | Cards + POST body |
| `app/sign-up/complete/complete-form.tsx` | Cards + POST body |
| Tests under `tests/auth/` and `tests/email/` | Schema, resolver, APIs, hook, digest chrome, cards |

---

### Task 1: Require `preferred_locale` on sign-up schemas

**Files:**
- Modify: `lib/auth/schemas.ts`
- Modify: `tests/auth/complete-google-signup-schema.test.ts`
- Modify: `tests/auth/complete-google-signup-api.test.ts` (fixture only, so the suite stays green)
- Create: `tests/auth/sign-up-schema.test.ts`

**Interfaces:**
- Consumes: existing `signUpSchema`, `completeGoogleSignupSchema`
- Produces: both schemas require `preferred_locale: "en" | "ms"` (no default)

- [ ] **Step 1: Write the failing tests**

Create `tests/auth/sign-up-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signUpSchema } from "@/lib/auth/schemas";

const valid = {
  email: "owner@example.test",
  password: "CorrectHorse1x",
  business_name: "Kedai Contoh",
  state_code: "KUL" as const,
  accept_terms: true as const,
  signup_path: "free" as const,
  preferred_locale: "en" as const,
};

describe("signUpSchema preferred_locale", () => {
  it("accepts en and ms", () => {
    expect(signUpSchema.parse(valid).preferred_locale).toBe("en");
    expect(
      signUpSchema.parse({ ...valid, preferred_locale: "ms" }).preferred_locale,
    ).toBe("ms");
  });

  it("rejects missing preferred_locale", () => {
    const { preferred_locale: _locale, ...rest } = valid;
    expect(signUpSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects fr and extra keys", () => {
    expect(
      signUpSchema.safeParse({ ...valid, preferred_locale: "fr" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...valid, preferred_locale: "en", role: "owner" })
        .success,
    ).toBe(false);
  });
});
```

In `tests/auth/complete-google-signup-schema.test.ts`, add `preferred_locale: "en" as const` to `valid`, include it in the first `toEqual`, and add:

```ts
it("requires preferred_locale en or ms", () => {
  const { preferred_locale: _locale, ...rest } = valid;
  expect(completeGoogleSignupSchema.safeParse(rest).success).toBe(false);
  expect(
    completeGoogleSignupSchema.safeParse({ ...valid, preferred_locale: "fr" })
      .success,
  ).toBe(false);
  expect(
    completeGoogleSignupSchema.parse({ ...valid, preferred_locale: "ms" })
      .preferred_locale,
  ).toBe("ms");
});
```

In `tests/auth/complete-google-signup-api.test.ts`, add `preferred_locale: "en"` to `VALID_BODY` so existing API tests still parse.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/auth/sign-up-schema.test.ts tests/auth/complete-google-signup-schema.test.ts`

Expected: FAIL — `preferred_locale` unrecognized / missing (strict object strip or undefined)

- [ ] **Step 3: Update schemas**

In `lib/auth/schemas.ts`, add the same required field to **both** `signUpSchema` and `completeGoogleSignupSchema` objects (keep `.strict()`):

```ts
preferred_locale: z.enum(["en", "ms"]),
```

Do not `.optional()` or `.default("en")`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/auth/sign-up-schema.test.ts tests/auth/complete-google-signup-schema.test.ts tests/auth/complete-google-signup-api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if execution mode includes commits)

```bash
git add lib/auth/schemas.ts tests/auth/sign-up-schema.test.ts tests/auth/complete-google-signup-schema.test.ts tests/auth/complete-google-signup-api.test.ts
git commit -m "feat: require preferred_locale on sign-up schemas"
```

---

### Task 2: Resolve locale from profile, then metadata hint

**Files:**
- Modify: `lib/email/resolve-locale.ts`
- Create: `tests/email/resolve-locale.test.ts`

**Interfaces:**
- Consumes: existing `EmailLocale`, service-role `from("users")`
- Produces:
  - `export function parseEmailLocaleHint(raw: unknown): EmailLocale | null`
  - `export async function resolvePreferredLocale(admin: Admin, userId: string, metadataHint?: unknown): Promise<EmailLocale>`
  - Order: profile `en`|`ms` → hint `en`|`ms` → `en`

- [ ] **Step 1: Write the failing test**

Create `tests/email/resolve-locale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseEmailLocaleHint,
  resolvePreferredLocale,
} from "@/lib/email/resolve-locale";

function fakeAdmin(row: { preferred_locale?: unknown } | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  };
}

describe("parseEmailLocaleHint", () => {
  it("accepts only en and ms", () => {
    expect(parseEmailLocaleHint("en")).toBe("en");
    expect(parseEmailLocaleHint("ms")).toBe("ms");
    expect(parseEmailLocaleHint("fr")).toBeNull();
    expect(parseEmailLocaleHint("")).toBeNull();
    expect(parseEmailLocaleHint(undefined)).toBeNull();
  });
});

describe("resolvePreferredLocale", () => {
  it("uses the profile row when it is en or ms", async () => {
    const admin = fakeAdmin({ preferred_locale: "ms" });
    await expect(
      resolvePreferredLocale(admin as never, "user-1", "en"),
    ).resolves.toBe("ms");
  });

  it("uses the metadata hint when there is no profile row", async () => {
    const admin = fakeAdmin(null);
    await expect(
      resolvePreferredLocale(admin as never, "user-1", "ms"),
    ).resolves.toBe("ms");
  });

  it("falls back to en when neither profile nor hint is valid", async () => {
    const admin = fakeAdmin(null);
    await expect(
      resolvePreferredLocale(admin as never, "user-1", "fr"),
    ).resolves.toBe("en");
    await expect(
      resolvePreferredLocale(admin as never, "user-1"),
    ).resolves.toBe("en");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/email/resolve-locale.test.ts`

Expected: FAIL — `parseEmailLocaleHint` is not exported; third argument ignored so no-profile + `ms` hint returns `en`

- [ ] **Step 3: Implement resolver**

Replace `lib/email/resolve-locale.ts` with:

```ts
import type { EmailLocale } from "@/lib/email/types";
import type { createServiceRoleClient } from "@/lib/supabase/service-role";

type Admin = ReturnType<typeof createServiceRoleClient>;

export function parseEmailLocaleHint(raw: unknown): EmailLocale | null {
  return raw === "ms" || raw === "en" ? raw : null;
}

export async function resolvePreferredLocale(
  admin: Admin,
  userId: string,
  metadataHint?: unknown,
): Promise<EmailLocale> {
  const { data } = await admin
    .from("users")
    .select("preferred_locale")
    .eq("id", userId)
    .maybeSingle();

  const raw =
    data && typeof data === "object" && "preferred_locale" in data
      ? (data as { preferred_locale?: unknown }).preferred_locale
      : null;
  if (raw === "ms" || raw === "en") return raw;

  return parseEmailLocaleHint(metadataHint) ?? "en";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/email/resolve-locale.test.ts tests/email/auth-send-email-route.test.ts`

Expected: PASS (existing hook test still defaults profile to `en`)

- [ ] **Step 5: Commit** (only if execution mode includes commits)

```bash
git add lib/email/resolve-locale.ts tests/email/resolve-locale.test.ts
git commit -m "feat: fall back Auth email locale to metadata hint"
```

---

### Task 3: Write `preferred_locale` on owner provision

**Files:**
- Modify: `lib/auth/provision-owner-business.ts`
- Create: `tests/auth/provision-owner-locale.test.ts`

**Interfaces:**
- Consumes: `EmailLocale` from `@/lib/email/types`
- Produces:
  - `ProvisionOwnerInput.preferredLocale: EmailLocale` (required)
  - `export function ownerProfileInsertPayload(input: Pick<ProvisionOwnerInput, "authUserId" | "email" | "businessName" | "preferredLocale">, businessId: string)`
  - `users` insert includes `preferred_locale: input.preferredLocale`

- [ ] **Step 1: Write the failing test**

Create `tests/auth/provision-owner-locale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ownerProfileInsertPayload } from "@/lib/auth/provision-owner-business";

describe("ownerProfileInsertPayload", () => {
  it("includes preferred_locale from provision input", () => {
    expect(
      ownerProfileInsertPayload(
        {
          authUserId: "11111111-1111-1111-1111-111111111111",
          email: "owner@example.test",
          businessName: "Kedai Contoh",
          preferredLocale: "ms",
        },
        "biz-1",
      ),
    ).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      business_id: "biz-1",
      role: "owner",
      display_name: "Kedai Contoh",
      email: "owner@example.test",
      preferred_locale: "ms",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/provision-owner-locale.test.ts`

Expected: FAIL — `ownerProfileInsertPayload` is not exported

- [ ] **Step 3: Implement payload helper and insert**

In `lib/auth/provision-owner-business.ts`:

1. Add `import type { EmailLocale } from "@/lib/email/types";`
2. Add `preferredLocale: EmailLocale` to `ProvisionOwnerInput`.
3. Add and export:

```ts
export function ownerProfileInsertPayload(
  input: Pick<
    ProvisionOwnerInput,
    "authUserId" | "email" | "businessName" | "preferredLocale"
  >,
  businessId: string,
): {
  id: string;
  business_id: string;
  role: "owner";
  display_name: string;
  email: string;
  preferred_locale: EmailLocale;
} {
  return {
    id: input.authUserId,
    business_id: businessId,
    role: "owner",
    display_name: input.businessName,
    email: input.email,
    preferred_locale: input.preferredLocale,
  };
}
```

4. Change the `users` insert to:

```ts
  const { error: profileError } = await admin.from("users").insert({
    ...ownerProfileInsertPayload(input, businessRow.id),
    last_password_change_at: new Date().toISOString(),
  });
```

Call sites in Task 4 and Task 5 will pass `preferredLocale`. Until those land, `npx tsc --noEmit` will fail — that is expected; do not change those routes in this task except if the type-check is run as part of a later task.

- [ ] **Step 4: Run the new unit test**

Run: `npx vitest run tests/auth/provision-owner-locale.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if execution mode includes commits)

```bash
git add lib/auth/provision-owner-business.ts tests/auth/provision-owner-locale.test.ts
git commit -m "feat: persist preferred_locale when provisioning owners"
```

---

### Task 4: Email sign-up writes locale to Auth metadata and provision

**Files:**
- Modify: `app/api/auth/sign-up/route.ts`
- Create: `tests/auth/sign-up-locale-api.test.ts`

**Interfaces:**
- Consumes: `parsed.preferred_locale` from Task 1; `provisionOwnerBusiness` `preferredLocale` from Task 3
- Produces: `createUser` `user_metadata.preferred_locale`; provision `preferredLocale`

- [ ] **Step 1: Write the failing test**

Create `tests/auth/sign-up-locale-api.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_BODY = {
  email: "owner@example.test",
  password: "CorrectHorse1x",
  business_name: "Kedai Contoh",
  state_code: "KUL",
  accept_terms: true,
  signup_path: "free",
  preferred_locale: "ms",
};

async function loadRoute() {
  vi.resetModules();
  vi.doMock("@/lib/platform/deployment", () => ({
    isStandaloneDeployment: () => false,
  }));
  vi.doMock("@/lib/auth/email-verification-policy", () => ({
    isEmailVerificationRequired: () => false,
  }));
  const createUser = vi.fn(async () => ({
    data: { user: { id: "user-1", email: VALID_BODY.email } },
    error: null,
  }));
  const provisionOwnerBusiness = vi.fn(async () => ({
    ok: true as const,
    businessId: "biz-1",
    idcompany: "kedai-contoh-abc123",
  }));
  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: () => ({
      auth: { admin: { createUser, deleteUser: vi.fn() } },
    }),
  }));
  vi.doMock("@/lib/auth/provision-owner-business", () => ({
    provisionOwnerBusiness,
  }));
  const route = await import("@/app/api/auth/sign-up/route");
  return { POST: route.POST, createUser, provisionOwnerBusiness };
}

function buildRequest(body: unknown, ip = "203.0.113.40"): Request {
  return new Request("http://localhost/api/auth/sign-up", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/platform/deployment");
  vi.doUnmock("@/lib/auth/email-verification-policy");
  vi.doUnmock("@/lib/supabase/service-role");
  vi.doUnmock("@/lib/auth/provision-owner-business");
});

describe("POST /api/auth/sign-up locale", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("writes preferred_locale to Auth metadata and provision", async () => {
    const { POST, createUser, provisionOwnerBusiness } = await loadRoute();
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user_metadata: expect.objectContaining({
          preferred_locale: "ms",
          signup_source: "self_serve",
        }),
      }),
    );
    expect(provisionOwnerBusiness).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ preferredLocale: "ms" }),
    );
  });

  it("returns 400 when preferred_locale is missing", async () => {
    const { POST, provisionOwnerBusiness } = await loadRoute();
    const { preferred_locale: _locale, ...rest } = VALID_BODY;
    const res = await POST(buildRequest(rest, "203.0.113.41"));
    expect(res.status).toBe(400);
    expect(provisionOwnerBusiness).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/sign-up-locale-api.test.ts`

Expected: FAIL — `user_metadata` has no `preferred_locale`; provision input has no `preferredLocale` (and TypeScript may already error at the provision call)

- [ ] **Step 3: Wire the route**

In `app/api/auth/sign-up/route.ts` `createUser` metadata, add `preferred_locale: parsed.preferred_locale` next to `business_name` and `signup_source`.

In the `provisionOwnerBusiness` call, add `preferredLocale: parsed.preferred_locale`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/auth/sign-up-locale-api.test.ts tests/auth/sign-up-schema.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if execution mode includes commits)

```bash
git add app/api/auth/sign-up/route.ts tests/auth/sign-up-locale-api.test.ts
git commit -m "feat: save sign-up language on Auth metadata and profile"
```

---

### Task 5: Google complete writes locale and updates Auth metadata

**Files:**
- Modify: `app/api/auth/complete-google-signup/route.ts`
- Modify: `tests/auth/complete-google-signup-api.test.ts`

**Interfaces:**
- Consumes: `parsed.preferred_locale`; `provisionOwnerBusiness` `preferredLocale`
- Produces: provision `preferredLocale`; after success `admin.auth.admin.updateUserById` merges `user_metadata.preferred_locale`. Idempotent complete does **not** call updateUser or provision.

- [ ] **Step 1: Extend the API harness and add failing assertions**

In `tests/auth/complete-google-signup-api.test.ts`:

1. Add `updateUserById` to the harness:

```ts
interface Harness {
  POST: (request: Request) => Promise<Response>;
  provisionOwnerBusiness: ReturnType<typeof vi.fn>;
  updateUserById: ReturnType<typeof vi.fn>;
}
```

2. Inside `loadRoute`, create `const updateUserById = vi.fn(async () => ({ data: {}, error: null }));` and attach it on the mocked service-role client:

```ts
  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: () => ({
      auth: { admin: { updateUserById } },
      from: (table: string) => {
        // existing users lookup unchanged
```

3. Return `{ POST: route.POST, provisionOwnerBusiness, updateUserById }`.

4. In `"provisions from the session email, not the body"`, set `VALID_BODY.preferred_locale` to `"ms"` for that test only (or change the shared fixture to `"en"` and override in this test):

```ts
  it("provisions preferredLocale and updates Auth metadata", async () => {
    const { POST, provisionOwnerBusiness, updateUserById } = await loadRoute({
      profileById: null,
      profileByEmail: null,
    });
    const res = await POST(
      buildRequest({ ...VALID_BODY, preferred_locale: "ms" }),
    );
    expect(res.status).toBe(200);
    const input = provisionOwnerBusiness.mock.calls[0][1] as {
      preferredLocale: string;
    };
    expect(input.preferredLocale).toBe("ms");
    expect(updateUserById).toHaveBeenCalledWith(
      AUTH_USER.id,
      expect.objectContaining({
        user_metadata: expect.objectContaining({ preferred_locale: "ms" }),
      }),
    );
  });
```

5. In the idempotent test, assert `updateUserById` was **not** called.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/complete-google-signup-api.test.ts`

Expected: FAIL — provision input missing `preferredLocale`; `updateUserById` never called

- [ ] **Step 3: Wire the route**

In `app/api/auth/complete-google-signup/route.ts`:

1. Pass `preferredLocale: parsed.preferred_locale` into `provisionOwnerBusiness`.
2. After `result.ok`, before the success JSON:

```ts
  const existingMeta =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...existingMeta,
      preferred_locale: parsed.preferred_locale,
      signup_source: "google",
    },
  });
  if (metaError) {
    logger.warn("auth.complete_google.metadata_locale_failed", {
      userId: user.id,
    });
  }
```

Use the existing app logger (`import { logger } from "@/lib/logger"`). Do **not** fail the request if metadata update fails — `public.users` is source of truth. Do **not** update metadata on the `already_complete` branch.

Ignore any locale query param on `/auth/callback` (no code change there).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/auth/complete-google-signup-api.test.ts tests/auth/complete-google-signup-schema.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if execution mode includes commits)

```bash
git add app/api/auth/complete-google-signup/route.ts tests/auth/complete-google-signup-api.test.ts
git commit -m "feat: save Google complete language on profile and metadata"
```

---

### Task 6: Auth Send Email hook uses the metadata hint

**Files:**
- Modify: `app/api/webhooks/auth-send-email/route.ts`
- Modify: `tests/email/auth-send-email-route.test.ts`

**Interfaces:**
- Consumes: `resolvePreferredLocale(admin, userId, hint)` from Task 2; `parseEmailLocaleHint`
- Produces: locale for `authEmailCopy` = profile, else payload `user.user_metadata.preferred_locale` if `en`|`ms`, else `en`

- [ ] **Step 1: Make the hook test harness configurable and add failing cases**

In `tests/email/auth-send-email-route.test.ts`, change `loadRoute` to accept options and mock the users row accordingly:

```ts
async function loadRoute(opts?: { profileLocale?: string | null }) {
  vi.resetModules();
  vi.doMock("@/lib/marketing/email-resend", () => ({ sendEmail }));
  vi.doMock("@/lib/logger", () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), child: () => ({ error: vi.fn() }) },
  }));
  const profileLocale = opts?.profileLocale === undefined ? "en" : opts.profileLocale;
  vi.doMock("@/lib/supabase/service-role", () => ({
    createServiceRoleClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data:
                profileLocale === null ? null : { preferred_locale: profileLocale },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }));
  process.env.AUTH_SEND_EMAIL_HOOK_SECRET = SECRET_RAW;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  process.env.MARKETING_FROM_EMAIL = "noreply@app.niagax.my";
  process.env.RESEND_API_KEY = "re_test_key";
  return import("@/app/api/webhooks/auth-send-email/route");
}
```

Add tests (recovery MS heading is `Tetapkan kata laluan baharu`; English is `Set a new password`):

```ts
  it("uses Malay copy when the profile locale is ms", async () => {
    const { POST } = await loadRoute({ profileLocale: "ms" });
    await POST(signedRequest(JSON.stringify(PAYLOAD), true));
    expect(sendEmail.mock.calls[0][0]).toEqual(
      expect.objectContaining({ subject: "Tetapkan semula kata laluan NiagaX" }),
    );
  });

  it("uses Malay copy from metadata when there is no profile", async () => {
    const { POST } = await loadRoute({ profileLocale: null });
    const body = {
      ...PAYLOAD,
      user: {
        ...PAYLOAD.user,
        user_metadata: { preferred_locale: "ms" },
      },
    };
    await POST(signedRequest(JSON.stringify(body), true));
    expect(sendEmail.mock.calls[0][0]).toEqual(
      expect.objectContaining({ subject: "Tetapkan semula kata laluan NiagaX" }),
    );
  });

  it("uses English when metadata locale is fr and there is no profile", async () => {
    const { POST } = await loadRoute({ profileLocale: null });
    const body = {
      ...PAYLOAD,
      user: {
        ...PAYLOAD.user,
        user_metadata: { preferred_locale: "fr" },
      },
    };
    await POST(signedRequest(JSON.stringify(body), true));
    expect(sendEmail.mock.calls[0][0]).toEqual(
      expect.objectContaining({ subject: "Reset your NiagaX password" }),
    );
  });
```

Keep the existing 401 and valid-recovery tests.

- [ ] **Step 2: Run tests to verify the new cases fail**

Run: `npx vitest run tests/email/auth-send-email-route.test.ts`

Expected: FAIL — no-profile + metadata `ms` still sends English subject (hook does not pass the hint)

- [ ] **Step 3: Pass the hint into the resolver**

In `app/api/webhooks/auth-send-email/route.ts`, replace the locale block with:

```ts
  const meta = (user as { user_metadata?: unknown }).user_metadata;
  const localeHint = metadataString(meta, "preferred_locale");
  const locale =
    typeof userId === "string"
      ? await resolvePreferredLocale(
          createServiceRoleClient(),
          userId,
          localeHint,
        )
      : parseEmailLocaleHint(localeHint) ?? "en";
```

Import `parseEmailLocaleHint` from `@/lib/email/resolve-locale`. Move `const meta = ...` above locale resolution (it is currently below). Keep `authEmailCopy` using the same `meta`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/email/auth-send-email-route.test.ts tests/email/resolve-locale.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if execution mode includes commits)

```bash
git add app/api/webhooks/auth-send-email/route.ts tests/email/auth-send-email-route.test.ts
git commit -m "feat: use sign-up language hint on Auth emails"
```

---

### Task 7: Boardroom digest chrome follows owner locale

**Files:**
- Modify: `lib/email/copy.ts`
- Modify: `app/api/cron/boardroom-weekly-digest/route.ts`
- Create: `tests/email/digest-chrome.test.ts`

**Interfaces:**
- Consumes: `EmailLocale`; owner `preferred_locale`
- Produces: `export function digestEmailChrome(locale: EmailLocale): { ctaLabel: string; footerText: string }`
  - `en` CTA: `Open Boardroom`; footer: `Weekly Boardroom digest from NiagaX. Bantu Niaga Sdn. Bhd.`
  - `ms` CTA: `Buka Boardroom`; footer: `Ringkasan Boardroom mingguan daripada NiagaX. Bantu Niaga Sdn. Bhd.`
- Digest `subject` / `body` from `buildBoardroomWeeklyDigest` stay unchanged (English).

- [ ] **Step 1: Write the failing test**

Create `tests/email/digest-chrome.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { digestEmailChrome } from "@/lib/email/copy";
import { renderNiagaXEmail } from "@/lib/email/layout";

describe("digestEmailChrome", () => {
  it("returns Malay CTA and footer for ms", () => {
    const chrome = digestEmailChrome("ms");
    expect(chrome.ctaLabel).toBe("Buka Boardroom");
    expect(chrome.footerText).toMatch(/Ringkasan Boardroom/i);
    const html = renderNiagaXEmail({
      locale: "ms",
      brandName: "NiagaX",
      subject: "Weekly digest",
      heading: "Weekly digest",
      bodyText: "English body stays as generated.",
      ctaLabel: chrome.ctaLabel,
      ctaHref: "https://app.niagax.my/boardroom",
      footerText: chrome.footerText,
    });
    expect(html).toContain('lang="ms"');
    expect(html).toContain("Buka Boardroom");
    expect(html).toContain("English body stays as generated.");
  });

  it("keeps English chrome for en", () => {
    expect(digestEmailChrome("en")).toEqual({
      ctaLabel: "Open Boardroom",
      footerText: "Weekly Boardroom digest from NiagaX. Bantu Niaga Sdn. Bhd.",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/email/digest-chrome.test.ts`

Expected: FAIL — `digestEmailChrome` is not exported

- [ ] **Step 3: Add chrome helper and use it in the cron**

At the bottom of `lib/email/copy.ts`:

```ts
export function digestEmailChrome(locale: EmailLocale): {
  ctaLabel: string;
  footerText: string;
} {
  if (locale === "ms") {
    return {
      ctaLabel: "Buka Boardroom",
      footerText:
        "Ringkasan Boardroom mingguan daripada NiagaX. Bantu Niaga Sdn. Bhd.",
    };
  }
  return {
    ctaLabel: "Open Boardroom",
    footerText: "Weekly Boardroom digest from NiagaX. Bantu Niaga Sdn. Bhd.",
  };
}
```

In `app/api/cron/boardroom-weekly-digest/route.ts`:

1. Import `digestEmailChrome` from `@/lib/email/copy` and `parseEmailLocaleHint` from `@/lib/email/resolve-locale`.
2. Change the owner select from `"id, email"` to `"id, email, preferred_locale"`.
3. Replace hardcoded `locale: "en"` / CTA / footer with:

```ts
      const locale = parseEmailLocaleHint(owner.preferred_locale) ?? "en";
      const chrome = digestEmailChrome(locale);
      const html = renderNiagaXEmail({
        locale,
        brandName: "NiagaX",
        subject: digest.subject,
        heading: digest.subject,
        bodyText: digest.body,
        ctaLabel: chrome.ctaLabel,
        ctaHref: appUrl ? `${appUrl}/boardroom` : undefined,
        footerText: chrome.footerText,
      });
```

Leave `sendPlatformEmail` `subject` / `body` as the English digest text.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/email/digest-chrome.test.ts`

Expected: PASS

- [ ] **Step 5: Commit** (only if execution mode includes commits)

```bash
git add lib/email/copy.ts app/api/cron/boardroom-weekly-digest/route.ts tests/email/digest-chrome.test.ts
git commit -m "feat: localize Boardroom digest email chrome"
```

---

### Task 8: Language cards on email and Google sign-up forms

**Files:**
- Create: `components/auth/SignupLanguageCards.tsx`
- Create: `tests/auth/signup-language-cards.test.tsx`
- Modify: `app/sign-up/page.tsx`
- Modify: `app/sign-up/complete/complete-form.tsx`

**Interfaces:**
- Consumes: none (local state only; no GET/PATCH)
- Produces: `export function SignupLanguageCards(props: { value: "en" | "ms" | null; onChange: (next: "en" | "ms") => void })`
- Copy: group caption `Used for emails. You can change this later in Settings.` Error: `Choose English or Bahasa Melayu.`
- Placement: after plan cards, first control inside the `<form>`, before Business name. Do **not** disable submit for a missing language (existing password/terms disable stays).

- [ ] **Step 1: Write the failing component test**

Create `tests/auth/signup-language-cards.test.tsx`:

```tsx
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignupLanguageCards } from "@/components/auth/SignupLanguageCards";

afterEach(() => {
  cleanup();
});

describe("SignupLanguageCards", () => {
  it("has no language selected until the user picks one", () => {
    render(<SignupLanguageCards value={null} onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios.every((el) => (el as HTMLInputElement).checked)).toBe(false);
  });

  it("calls onChange with ms when Bahasa Melayu is chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SignupLanguageCards value={null} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: /Bahasa Melayu/i }));
    expect(onChange).toHaveBeenCalledWith("ms");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/signup-language-cards.test.tsx`

Expected: FAIL — cannot find module `@/components/auth/SignupLanguageCards`

- [ ] **Step 3: Implement the cards**

Create `components/auth/SignupLanguageCards.tsx` as a client component. Reuse the two-card look from `components/settings/AppearanceLanguageCard.tsx` (`cn`, selected `border-accent-500 bg-brand-50`, radios `sr-only`). Differences: no fetch; `value` may be `null`; no card captions beyond the language name; one group caption under the cards.

```tsx
"use client";

import { cn } from "@/lib/utils/cn";

type Locale = "en" | "ms";

const OPTIONS: readonly { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ms", label: "Bahasa Melayu" },
];

export function SignupLanguageCards({
  value,
  onChange,
}: {
  value: Locale | null;
  onChange: (next: Locale) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-ink dark:text-cream-100">
        Language
      </legend>
      <div
        role="radiogroup"
        aria-label="Language"
        className="grid gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors",
                "focus-within:ring-2 focus-within:ring-brand-400",
                selected
                  ? "border-accent-500 bg-brand-50 dark:bg-brand-900/30"
                  : "border-cream-300 bg-white hover:bg-cream-50 dark:border-hairline-dark dark:bg-panel-dark dark:hover:border-brand-700",
              )}
            >
              <input
                type="radio"
                name="preferred-locale"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "text-sm font-semibold",
                  selected
                    ? "text-brand-700 dark:text-brand-200"
                    : "text-ink dark:text-cream-100",
                )}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-muted dark:text-cream-400">
        Used for emails. You can change this later in Settings.
      </p>
    </fieldset>
  );
}
```

Leave `AppearanceLanguageCard` unchanged (it still loads/saves via PATCH).

- [ ] **Step 4: Wire both forms**

`app/sign-up/page.tsx`:

1. Import `SignupLanguageCards`.
2. `const [preferredLocale, setPreferredLocale] = useState<"en" | "ms" | null>(null);`
3. At the top of `handleSubmit`, after `setError(null)`:

```ts
    if (!preferredLocale) {
      setError("Choose English or Bahasa Melayu.");
      return;
    }
```

4. Add `preferred_locale: preferredLocale` to the JSON body.
5. Render `<SignupLanguageCards value={preferredLocale} onChange={setPreferredLocale} />` as the first child inside `<form className="space-y-4">`, before Business name.
6. Do not add `preferredLocale` to the submit `disabled` expression.

`app/sign-up/complete/complete-form.tsx`: same state, same submit guard, same JSON key, same first-in-form placement. Do not read locale from the URL.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/auth/signup-language-cards.test.tsx tests/auth/sign-up-schema.test.ts tests/auth/complete-google-signup-schema.test.ts tests/auth/sign-up-locale-api.test.ts tests/auth/complete-google-signup-api.test.ts tests/email/resolve-locale.test.ts tests/email/auth-send-email-route.test.ts tests/email/digest-chrome.test.ts tests/auth/provision-owner-locale.test.ts tests/settings/profile-locale-schema.test.ts`

Expected: PASS

Then: `npx tsc --noEmit`

Expected: PASS

- [ ] **Step 6: Commit** (only if execution mode includes commits)

```bash
git add components/auth/SignupLanguageCards.tsx tests/auth/signup-language-cards.test.tsx app/sign-up/page.tsx app/sign-up/complete/complete-form.tsx
git commit -m "feat: require language choice on email and Google sign-up"
```

---

## Spec coverage

| Spec requirement | Task |
|------------------|------|
| Required EN/MS on `/sign-up` and `/sign-up/complete` | 1, 8 |
| Persist `public.users.preferred_locale` | 3, 4, 5 |
| Auth metadata hint for confirm-email race | 4, 5, 2, 6 |
| Auth mail follows locale | 2, 6 |
| Boardroom digest chrome follows owner locale; body English | 7 |
| Customer invoices / broadcasts / invitees unchanged | (non-goals; no task) |
| Settings Appearance unchanged | 8 (explicit non-edit) |
| Client error copy; submit not disabled for language | 8 |
| Ignore OAuth locale query | 5 |
| Idempotent Google complete does not change locale | 5 |
| Schema rejects `fr` / extra keys | 1 |
| Profile PATCH still own-row | existing tests in Task 8 run |

## Out of scope leftovers

- Full in-app i18n (next-intl)
- Language on `/sign-up/guide`
- Translating invoice or broadcast copy
- Translating Boardroom digest body
