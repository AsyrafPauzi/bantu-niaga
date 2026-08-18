# Google Sign-up Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After Google OAuth, new users finish plan / business / state / terms on `/sign-up/complete`; existing NiagaX profiles sign in as today.

**Architecture:** Keep Google OAuth as-is. Change `/auth/callback` so a session without `public.users` goes to `/sign-up/complete` instead of `no_account`. A shared `provisionOwnerBusiness` helper creates the tenant (same as email sign-up) without creating or deleting an Auth user. Middleware blocks incomplete sessions from the app shell using a `public.users` lookup by Auth uid (not `user_metadata`).

**Tech Stack:** Next.js 15 App Router, Supabase Auth (`signInWithOAuth` + PKCE callback), Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-google-signup-complete-design.md`

## Global Constraints

- SaaS only. Standalone: no Google button; complete API returns 403.
- Complete identity comes from the **server session** (`auth.uid` + `user.email`). Ignore body `email` / `password` / `user_id`.
- Do not authorize on `user_metadata` / `raw_user_meta_data`.
- `getCurrentUser()` throws `no_profile` for incomplete Google users — the complete API must use `supabase.auth.getUser()` instead.
- Terms: `accept_terms` literal `true`. Zod `.strict()` on the complete body.
- Existing profile for this Auth uid → sign in (`/home` or sanitized `next`). Never show the complete form.
- Same email on a **different** `public.users.id` → sign out, `auth_error=email_taken`. Do not merge Auth users.
- Incomplete session cannot use `/(app)` or other `/api/*`. Allowed: `/sign-up/complete`, `POST /api/auth/complete-google-signup`, `/auth/callback`, `/legal/*`.
- Provision failure: roll back business/profile/membership/consents/invoice. **Keep** the Google Auth user.
- Email verification loop is not used on the Google complete path.
- `lib/auth/incomplete-session.ts` must stay Edge-safe: no `server-only`, no Node-only APIs.
- Commits only when the user asks, unless they chose an execution mode that includes commits.

## File map

| File | Role |
|------|------|
| `lib/auth/social-login.ts` | `email_taken` copy |
| `lib/auth/schemas.ts` | Shared MY state enum + `completeGoogleSignupSchema` |
| `lib/auth/google-callback.ts` | Pure `resolveGoogleCallbackTarget` |
| `lib/auth/incomplete-session.ts` | Pure middleware decision (Edge-safe) |
| `lib/auth/provision-owner-business.ts` | Shared tenant provision (server-only) |
| `app/auth/callback/route.ts` | Use resolver; keep session for complete |
| `app/api/auth/sign-up/route.ts` | Call shared provision; still `createUser` + optional Auth delete |
| `app/api/auth/complete-google-signup/route.ts` | New POST |
| `middleware.ts` | Incomplete gate + matcher for auth pages |
| `app/sign-up/page.tsx` | Google button (SaaS) |
| `app/sign-up/complete/page.tsx` | New complete form |
| Tests under `tests/auth/` | Schema, resolver, gate, complete API, social copy |

---

### Task 1: `email_taken` user copy

**Files:**
- Modify: `lib/auth/social-login.ts`
- Test: `tests/auth/social-login.test.ts`

**Interfaces:**
- Consumes: existing `socialAuthErrorMessage(code: string | null): string | null`
- Produces: same function; new case `email_taken`

- [ ] **Step 1: Write the failing assertion**

In `tests/auth/social-login.test.ts`, extend the existing describe:

```ts
it("maps email_taken", () => {
  expect(socialAuthErrorMessage("email_taken")).toMatch(
    /already belongs to a NiagaX account/i,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/social-login.test.ts`

Expected: FAIL — `email_taken` falls through to the default `` `Google sign-in could not be completed: ${code}` ``

- [ ] **Step 3: Implement the case**

In `socialAuthErrorMessage`, add before `default`:

```ts
case "email_taken":
  return "That Google email already belongs to a NiagaX account. Sign in with the original method.";
```

Keep `no_account` copy unchanged (unused on the new happy path, still valid if an old link is opened).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/auth/social-login.test.ts`

Expected: PASS

- [ ] **Step 5: Commit if the user asked**

```bash
git add lib/auth/social-login.ts tests/auth/social-login.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): explain Google email already linked to NiagaX

EOF
)"
```

---

### Task 2: `completeGoogleSignupSchema`

**Files:**
- Modify: `lib/auth/schemas.ts`
- Test: `tests/auth/complete-google-signup-schema.test.ts`

**Interfaces:**
- Consumes: existing `onboardingQuizSchema`; existing state enum on `signUpSchema`
- Produces:
  - `export const malaysianStateCodeSchema` — same 16-code enum currently inlined on `signUpSchema`
  - `export const completeGoogleSignupSchema` — Zod object `.strict()`
  - `export type CompleteGoogleSignupInput = z.infer<typeof completeGoogleSignupSchema>`

- [ ] **Step 1: Write the failing test**

Create `tests/auth/complete-google-signup-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { completeGoogleSignupSchema } from "@/lib/auth/schemas";

const valid = {
  business_name: "Nasi Lemak Berkat",
  state_code: "KUL",
  accept_terms: true as const,
  signup_path: "free" as const,
};

describe("completeGoogleSignupSchema", () => {
  it("accepts plan, business, state, and terms", () => {
    expect(completeGoogleSignupSchema.parse(valid)).toEqual({
      ...valid,
      signup_path: "free",
    });
  });

  it("defaults signup_path to free", () => {
    const { signup_path, ...rest } = valid;
    expect(completeGoogleSignupSchema.parse(rest).signup_path).toBe("free");
  });

  it("rejects extra keys including email and password", () => {
    const result = completeGoogleSignupSchema.safeParse({
      ...valid,
      email: "attacker@example.test",
      password: "HackedPass1x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects accept_terms false", () => {
    expect(
      completeGoogleSignupSchema.safeParse({ ...valid, accept_terms: false })
        .success,
    ).toBe(false);
  });

  it("rejects short business_name", () => {
    expect(
      completeGoogleSignupSchema.safeParse({ ...valid, business_name: "A" })
        .success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/complete-google-signup-schema.test.ts`

Expected: FAIL — `completeGoogleSignupSchema` is not exported

- [ ] **Step 3: Implement schemas**

In `lib/auth/schemas.ts`:

1. Extract the state enum into:

```ts
export const malaysianStateCodeSchema = z.enum([
  "JHR",
  "KDH",
  "KTN",
  "MLK",
  "NSN",
  "PHG",
  "PNG",
  "PRK",
  "PLS",
  "SBH",
  "SWK",
  "SGR",
  "TRG",
  "KUL",
  "LBN",
  "PJY",
]);
```

2. Replace the inlined enum on `signUpSchema` and `addBusinessSchema` with `malaysianStateCodeSchema` (behaviour unchanged).

3. Add:

```ts
export const completeGoogleSignupSchema = z
  .object({
    business_name: z
      .string()
      .trim()
      .min(2, "Business name is too short")
      .max(120),
    state_code: malaysianStateCodeSchema.optional(),
    accept_terms: z.literal(true, {
      message: "Accept the terms to continue",
    }),
    signup_path: z.enum(["free", "starter_trial"]).optional().default("free"),
    onboarding_quiz: onboardingQuizSchema.optional(),
  })
  .strict();

export type CompleteGoogleSignupInput = z.infer<
  typeof completeGoogleSignupSchema
>;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/auth/complete-google-signup-schema.test.ts tests/auth/company-switch-schemas.test.ts`

Expected: PASS

- [ ] **Step 5: Commit if the user asked**

```bash
git add lib/auth/schemas.ts tests/auth/complete-google-signup-schema.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): add Google complete-signup schema without email or password

EOF
)"
```

---

### Task 3: Pure Google callback target

**Files:**
- Create: `lib/auth/google-callback.ts`
- Test: `tests/auth/google-callback.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:

```ts
export type GoogleCallbackTarget =
  | { kind: "continue"; nextPath: string }
  | { kind: "complete" }
  | { kind: "email_taken" };

export function resolveGoogleCallbackTarget(opts: {
  authUserId: string;
  profileId: string | null;
  emailOwnerId: string | null;
  nextPath: string;
}): GoogleCallbackTarget;
```

Rules (spec §6):

1. If `profileId` is set → `{ kind: "continue", nextPath }` (caller already sanitized `nextPath`).
2. Else if `emailOwnerId` is set and `emailOwnerId !== authUserId` → `{ kind: "email_taken" }`.
3. Else → `{ kind: "complete" }`.

- [ ] **Step 1: Write the failing test**

Create `tests/auth/google-callback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveGoogleCallbackTarget } from "@/lib/auth/google-callback";

const uid = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";

describe("resolveGoogleCallbackTarget", () => {
  it("continues when a profile exists for this auth user", () => {
    expect(
      resolveGoogleCallbackTarget({
        authUserId: uid,
        profileId: uid,
        emailOwnerId: uid,
        nextPath: "/home",
      }),
    ).toEqual({ kind: "continue", nextPath: "/home" });
  });

  it("sends new Google users to complete", () => {
    expect(
      resolveGoogleCallbackTarget({
        authUserId: uid,
        profileId: null,
        emailOwnerId: null,
        nextPath: "/home",
      }),
    ).toEqual({ kind: "complete" });
  });

  it("blocks when the email belongs to a different profile", () => {
    expect(
      resolveGoogleCallbackTarget({
        authUserId: uid,
        profileId: null,
        emailOwnerId: other,
        nextPath: "/home",
      }),
    ).toEqual({ kind: "email_taken" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/google-callback.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Implement `lib/auth/google-callback.ts`**

```ts
export type GoogleCallbackTarget =
  | { kind: "continue"; nextPath: string }
  | { kind: "complete" }
  | { kind: "email_taken" };

export function resolveGoogleCallbackTarget(opts: {
  authUserId: string;
  profileId: string | null;
  emailOwnerId: string | null;
  nextPath: string;
}): GoogleCallbackTarget {
  if (opts.profileId) {
    return { kind: "continue", nextPath: opts.nextPath };
  }
  if (opts.emailOwnerId && opts.emailOwnerId !== opts.authUserId) {
    return { kind: "email_taken" };
  }
  return { kind: "complete" };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/auth/google-callback.test.ts`

Expected: PASS

- [ ] **Step 5: Commit if the user asked**

```bash
git add lib/auth/google-callback.ts tests/auth/google-callback.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): route Google callback to complete, home, or email-taken

EOF
)"
```

---

### Task 4: Edge-safe incomplete-session gate

**Files:**
- Create: `lib/auth/incomplete-session.ts`
- Test: `tests/auth/incomplete-session.test.ts`

**Interfaces:**
- Consumes: nothing (pathname strings only)
- Produces:

```ts
export type IncompleteSessionDecision =
  | "allow"
  | "redirect_complete"
  | "forbidden_api";

export function incompleteSessionDecision(opts: {
  pathname: string;
  hasProfile: boolean;
}): IncompleteSessionDecision;

export function isPublicAuthPath(pathname: string): boolean;
```

Rules when `hasProfile` is false:

- `allow`: `/sign-up/complete`, `/api/auth/complete-google-signup`, `/auth/callback`, paths starting with `/legal/`
- `forbidden_api`: any other path starting with `/api/`
- `redirect_complete`: everything else (`/sign-in`, `/sign-up`, `/home`, `/onboarding/recommendation`, …)

When `hasProfile` is true → always `allow` (this helper is only consulted for the incomplete branch in middleware, but tests lock the function).

`isPublicAuthPath`: unauthenticated users may hit `/sign-in`, `/sign-up`, `/sign-up/complete`, `/legal/*` without being bounced to `/sign-in` once those routes join the matcher.

- [ ] **Step 1: Write the failing test**

Create `tests/auth/incomplete-session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  incompleteSessionDecision,
  isPublicAuthPath,
} from "@/lib/auth/incomplete-session";

describe("incompleteSessionDecision", () => {
  it("allows complete page and complete API", () => {
    expect(
      incompleteSessionDecision({
        pathname: "/sign-up/complete",
        hasProfile: false,
      }),
    ).toBe("allow");
    expect(
      incompleteSessionDecision({
        pathname: "/api/auth/complete-google-signup",
        hasProfile: false,
      }),
    ).toBe("allow");
  });

  it("forbids other APIs", () => {
    expect(
      incompleteSessionDecision({
        pathname: "/api/finance/invoices",
        hasProfile: false,
      }),
    ).toBe("forbidden_api");
  });

  it("redirects app and auth pages", () => {
    expect(
      incompleteSessionDecision({ pathname: "/home", hasProfile: false }),
    ).toBe("redirect_complete");
    expect(
      incompleteSessionDecision({ pathname: "/sign-in", hasProfile: false }),
    ).toBe("redirect_complete");
    expect(
      incompleteSessionDecision({ pathname: "/sign-up", hasProfile: false }),
    ).toBe("redirect_complete");
  });

  it("allows when a profile exists", () => {
    expect(
      incompleteSessionDecision({ pathname: "/home", hasProfile: true }),
    ).toBe("allow");
  });
});

describe("isPublicAuthPath", () => {
  it("allows logged-out auth and legal pages", () => {
    expect(isPublicAuthPath("/sign-in")).toBe(true);
    expect(isPublicAuthPath("/sign-up")).toBe(true);
    expect(isPublicAuthPath("/sign-up/complete")).toBe(true);
    expect(isPublicAuthPath("/legal/terms")).toBe(true);
    expect(isPublicAuthPath("/home")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/incomplete-session.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Implement `lib/auth/incomplete-session.ts`**

```ts
export type IncompleteSessionDecision =
  | "allow"
  | "redirect_complete"
  | "forbidden_api";

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPublicAuthPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return (
    path === "/sign-in" ||
    path === "/sign-up" ||
    path === "/sign-up/complete" ||
    path.startsWith("/legal/")
  );
}

export function incompleteSessionDecision(opts: {
  pathname: string;
  hasProfile: boolean;
}): IncompleteSessionDecision {
  if (opts.hasProfile) return "allow";
  const path = normalizePath(opts.pathname);
  if (
    path === "/sign-up/complete" ||
    path === "/api/auth/complete-google-signup" ||
    path === "/auth/callback" ||
    path.startsWith("/legal/")
  ) {
    return "allow";
  }
  if (path.startsWith("/api/")) return "forbidden_api";
  return "redirect_complete";
}
```

No `import "server-only"`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/auth/incomplete-session.test.ts`

Expected: PASS

- [ ] **Step 5: Commit if the user asked**

```bash
git add lib/auth/incomplete-session.ts tests/auth/incomplete-session.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): gate incomplete Google sessions away from the app

EOF
)"
```

---

### Task 5: Shared `provisionOwnerBusiness`

**Files:**
- Create: `lib/auth/provision-owner-business.ts`
- Modify: `app/api/auth/sign-up/route.ts` (replace inlined business/profile/invoice/credits/audit/consents with the helper; keep `createUser`, verification email, and Auth-user rollback)
- Test: `tests/auth/provision-owner-plan.test.ts`

**Interfaces:**
- Consumes: `ensureMembership`, `issueSubscriptionInvoice`, `grantTierBundledCredits`, `freePlanRenewalAt`, `trialRenewalAt`, `subscriptionPeriodLabel`, `planQuizToDbPayload`, `DEFAULT_GENERIC_QUIZ_ANSWERS`, `OnboardingQuizInput`
- Produces:

```ts
export type SignupPath = "free" | "starter_trial";

export function ownerProvisionPlan(signupPath: SignupPath): {
  tier: "starter" | "micro";
  subscriptionStatus: "active" | "trial";
  trialDays: 0 | 14;
  grantCredits: boolean;
  periodLabel: string;
};

export async function provisionOwnerBusiness(
  admin: SupabaseClient,
  input: {
    authUserId: string;
    email: string;
    businessName: string;
    stateCode?: string;
    signupPath: SignupPath;
    onboardingQuiz?: OnboardingQuizInput;
    sourceIp: string | null;
    userAgent: string | null;
    signupSource: "self_serve" | "google";
  },
): Promise<
  | { ok: true; businessId: string; idcompany: string }
  | { ok: false; error: string; message: string; status: number }
>;
```

Move `slugifyBusiness` and `randomShort` into this file (unexported or exported for tests). Do **not** delete the Auth user inside this helper.

Rollback on failure after a business insert: consents (if any) → users → memberships if needed → businesses. Same reverse order as today’s sign-up route, minus `admin.auth.admin.deleteUser`.

`ownerProvisionPlan("free")` → `tier: "starter"`, `subscriptionStatus: "active"`, `grantCredits: false`, period label `${subscriptionPeriodLabel()} — Free plan`.

`ownerProvisionPlan("starter_trial")` → `tier: "micro"`, `subscriptionStatus: "trial"`, `grantCredits: true`, period label `"14-day Solo trial"`.

- [ ] **Step 1: Write the failing test**

Create `tests/auth/provision-owner-plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ownerProvisionPlan } from "@/lib/auth/provision-owner-business";

describe("ownerProvisionPlan", () => {
  it("maps free to starter active without credits", () => {
    const plan = ownerProvisionPlan("free");
    expect(plan.tier).toBe("starter");
    expect(plan.subscriptionStatus).toBe("active");
    expect(plan.grantCredits).toBe(false);
    expect(plan.trialDays).toBe(0);
  });

  it("maps starter_trial to micro trial with credits", () => {
    const plan = ownerProvisionPlan("starter_trial");
    expect(plan.tier).toBe("micro");
    expect(plan.subscriptionStatus).toBe("trial");
    expect(plan.grantCredits).toBe(true);
    expect(plan.trialDays).toBe(14);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/provision-owner-plan.test.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Implement helper and switch sign-up over**

`lib/auth/provision-owner-business.ts` starts with `import "server-only";`.

Copy the business insert through consents from `app/api/auth/sign-up/route.ts` (from `const idcompany = …` through the `user_consents` insert). Use `ownerProvisionPlan(input.signupPath)` for tier/status/credits/invoice label.

`subscription_renewal_at`: `freePlanRenewalAt()` when free, `trialRenewalAt()` when trial.

`users.display_name` and membership `display_name`: `input.businessName`.

`users.email`: `input.email` (already lower-cased by the caller).

`audit_log.action`: keep `"auth.sign_up"` for email path; for Google pass `signupSource: "google"` and set `diff.signup_source` to `"google"`. Do not use that field for authorization.

After a successful insert, if `plan.grantCredits`, call `grantTierBundledCredits(businessId, "micro", authUserId, admin)`.

On any failure after the business row exists, delete `user_consents` for that user, `users` row, `user_business_memberships` for that user/business if present, then `businesses`. Return `{ ok: false, error, message, status: 500 }` — never call `deleteUser`.

Then slim `POST` in `app/api/auth/sign-up/route.ts`: after `createUser` succeeds, call `provisionOwnerBusiness`. If `!result.ok`, `await rollback()` (existing Auth delete) and return the helper’s error JSON. Keep verification-email behaviour after a successful provision.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/auth/provision-owner-plan.test.ts tests/auth/complete-google-signup-schema.test.ts`

Expected: PASS. Manually confirm `app/api/auth/sign-up/route.ts` still compiles (`npx tsc --noEmit` if time).

- [ ] **Step 5: Commit if the user asked**

```bash
git add lib/auth/provision-owner-business.ts app/api/auth/sign-up/route.ts tests/auth/provision-owner-plan.test.ts
git commit -m "$(cat <<'EOF'
refactor(auth): share owner business provision between email and Google

EOF
)"
```

---

### Task 6: Wire `/auth/callback`

**Files:**
- Modify: `app/auth/callback/route.ts`
- Test: (logic covered by Task 3; no extra route mock required unless a thin integration test is cheap)

**Interfaces:**
- Consumes: `resolveGoogleCallbackTarget`, `sanitizeAuthNextPath`, `createServiceRoleClient`
- Produces: redirect `/sign-up/complete` | `next` | `/sign-in?auth_error=email_taken`

- [ ] **Step 1: Replace the `no_account` branch**

After `getUser()` succeeds, keep the existing `users` select by `id`.

Then:

```ts
const next = sanitizeAuthNextPath(url.searchParams.get("next"));
const profileId = profile?.id ?? null;

let emailOwnerId: string | null = null;
if (!profileId && user.email) {
  const admin = createServiceRoleClient();
  const email = user.email.trim().toLowerCase();
  const { data: emailOwner } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  emailOwnerId = emailOwner?.id ?? null;
}

const target = resolveGoogleCallbackTarget({
  authUserId: user.id,
  profileId,
  emailOwnerId,
  nextPath: next,
});

if (target.kind === "email_taken") {
  await supabase.auth.signOut();
  const redirect = new URL("/sign-in", url.origin);
  redirect.searchParams.set("auth_error", "email_taken");
  return NextResponse.redirect(redirect);
}

if (target.kind === "complete") {
  return NextResponse.redirect(new URL("/sign-up/complete", url.origin));
}

// kind === "continue" — existing session cookie + redirect to target.nextPath
```

Do **not** `signOut` on complete. Do **not** register the app session cookie until `kind === "continue"` (incomplete users have no `public.users` row for `registerNewSession`).

Remove the old `if (profileError || !profile) { signOut; auth_error=no_account }` block.

If `profileError` is a real query error (not empty), fail to `/sign-in?auth_error=missing_code` or a generic message — do not proceed to complete.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --pretty false`

Expected: no errors in `app/auth/callback/route.ts`

- [ ] **Step 3: Commit if the user asked**

```bash
git add app/auth/callback/route.ts
git commit -m "$(cat <<'EOF'
feat(auth): send new Google users to complete sign-up instead of bouncing

EOF
)"
```

---

### Task 7: `POST /api/auth/complete-google-signup`

**Files:**
- Create: `app/api/auth/complete-google-signup/route.ts`
- Test: `tests/auth/complete-google-signup-api.test.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient`, `createServiceRoleClient`, `completeGoogleSignupSchema`, `provisionOwnerBusiness`, `enforceAuthRateLimit`, `isStandaloneDeployment`
- Produces: JSON `{ ok: true }` | `{ ok: true, already_complete: true }` | 4xx/5xx

- [ ] **Step 1: Write failing tests**

Create `tests/auth/complete-google-signup-api.test.ts` using `vi.resetModules` + `vi.doMock` (same style as `tests/settings/profile-api.test.ts`).

Mock:

- `isStandaloneDeployment` → configurable boolean
- `createSupabaseServerClient` → `{ auth: { getUser: async () => ({ data: { user } }) } }`
- `createServiceRoleClient` → fluent mock: `users.select` by id then by email; `provisionOwnerBusiness` mocked as `vi.fn`

Minimum cases:

1. No session → 401
2. Standalone true → 403 `{ error: "signup_disabled" }`
3. Extra body `email` → 400 `validation_failed`
4. Session user, no profile, other id owns email → 409 `{ error: "email_taken" }`
5. Profile already exists for uid → 200 `{ ok: true, already_complete: true }` and do not call provision
6. Happy path → calls `provisionOwnerBusiness` with `authUserId` from session, `email` from session (not body), `signupSource: "google"` → 200 `{ ok: true }`

Valid POST body:

```ts
{
  business_name: "Kedai Contoh",
  state_code: "KUL",
  accept_terms: true,
  signup_path: "free",
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/auth/complete-google-signup-api.test.ts`

Expected: FAIL — route missing

- [ ] **Step 3: Implement the route**

```ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rl = enforceAuthRateLimit(
    request,
    "auth.complete-google-signup",
    5,
    60 * 60 * 1000,
  );
  if (!rl.ok) return rl.response;

  if (isStandaloneDeployment()) {
    return NextResponse.json(
      {
        error: "signup_disabled",
        message:
          "Self-serve sign-up is disabled on this installation. Sign in with your existing account.",
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = completeGoogleSignupSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const admin = createServiceRoleClient();
  const email = user.email.trim().toLowerCase();

  const { data: existing, error: existingError } = await admin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ ok: true, already_complete: true });
  }

  const { data: emailOwner } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (emailOwner && emailOwner.id !== user.id) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const result = await provisionOwnerBusiness(admin, {
    authUserId: user.id,
    email,
    businessName: parsed.business_name,
    stateCode: parsed.state_code,
    signupPath: parsed.signup_path,
    onboardingQuiz: parsed.onboarding_quiz,
    sourceIp,
    userAgent: request.headers.get("user-agent"),
    signupSource: "google",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true });
}
```

Optional: `admin.auth.admin.updateUserById(user.id, { user_metadata: { signup_source: "google" } })` — never read back for authz.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/auth/complete-google-signup-api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit if the user asked**

```bash
git add app/api/auth/complete-google-signup/route.ts tests/auth/complete-google-signup-api.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): complete Google sign-up from the session without a password

EOF
)"
```

---

### Task 8: Middleware incomplete gate

**Files:**
- Modify: `middleware.ts`

**Interfaces:**
- Consumes: `incompleteSessionDecision`, `isPublicAuthPath` from `lib/auth/incomplete-session.ts`
- Produces: redirects / 403 `signup_incomplete`

- [ ] **Step 1: Expand `config.matcher`**

Add these entries (keep existing app + api matchers):

```ts
"/sign-in",
"/sign-up",
"/sign-up/:path*",
"/legal/:path*",
"/onboarding/:path*",
```

- [ ] **Step 2: Unauthenticated public auth paths**

At the start of the `if (!user)` handling (before API 401 / sign-in redirect):

```ts
if (!user) {
  if (isPublicAuthPath(pathname)) {
    return response;
  }
  // existing API 401 + HTML → /sign-in
}
```

Without this, adding `/sign-in` to the matcher causes a redirect loop.

- [ ] **Step 3: Authenticated incomplete lookup**

After `user` is set and the existing email-verification allow-list runs, **before** `return response`:

```ts
const { data: profileRow, error: profileLookupError } = await supabase
  .from("users")
  .select("id")
  .eq("id", user.id)
  .maybeSingle();

if (profileLookupError) {
  // fail closed — same as getUser() catch: treat as unauthenticated for app
  user = null;
} else {
  const decision = incompleteSessionDecision({
    pathname,
    hasProfile: Boolean(profileRow),
  });
  if (decision === "allow") {
    return response;
  }
  if (decision === "forbidden_api") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "signup_incomplete",
          message: "Finish creating your business first.",
        },
        requestId,
      },
      {
        status: 403,
        headers: {
          "x-request-id": requestId,
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
  const completeUrl = request.nextUrl.clone();
  completeUrl.pathname = "/sign-up/complete";
  completeUrl.search = "";
  const redirect = NextResponse.redirect(completeUrl);
  redirect.headers.set("x-request-id", requestId);
  return redirect;
}
```

Use the **same** `supabase` client already created in middleware (user JWT). Do not use service role in Edge middleware. Own-row RLS: no row → `maybeSingle()` is null.

If `user` was nulled due to lookup error, fall through to the existing unauthenticated branch. `isPublicAuthPath` still allows `/sign-up/complete`.

Also allow the complete API when unauthenticated? No — the route returns 401. Matcher will send unauthenticated `/api/auth/complete-google-signup` to the generic API 401 unless we let the route run. Add `pathname === "/api/auth/complete-google-signup"` to the existing unauthenticated API allow-list (next to `/api/auth/sign-up`) so the handler can return 401 itself. Incomplete **authenticated** users are `allow` via `incompleteSessionDecision`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit --pretty false`

Expected: no errors in `middleware.ts`

- [ ] **Step 5: Commit if the user asked**

```bash
git add middleware.ts
git commit -m "$(cat <<'EOF'
feat(auth): block incomplete Google sessions from the app shell

EOF
)"
```

---

### Task 9: Google button on `/sign-up`

**Files:**
- Modify: `app/sign-up/page.tsx`

**Interfaces:**
- Consumes: existing `GoogleSignInButton`, `isPublicStandaloneDeployment`
- Produces: SaaS-only Google CTA above the email form

- [ ] **Step 1: Add the button**

Import `GoogleSignInButton` and `isPublicStandaloneDeployment`.

After the heading/subheading `<div>` (before the plan cards), insert the same SaaS split used on `app/sign-in/page.tsx`:

```tsx
{!isPublicStandaloneDeployment() ? (
  <>
    <GoogleSignInButton nextPath="/home" />
    <div className="flex items-center gap-3 text-xs text-ink-subtle dark:text-cream-400">
      <span className="h-px flex-1 bg-cream-300 dark:bg-hairline-dark" />
      OR SIGN UP WITH EMAIL
      <span className="h-px flex-1 bg-cream-300 dark:bg-hairline-dark" />
    </div>
  </>
) : null}
```

Do not change email/password fields. Callback ignores `next` for new users (always complete). Existing Google accounts still go `/home`.

- [ ] **Step 2: Confirm standalone still hides it**

`isPublicStandaloneDeployment()` is the same helper as sign-in. No new env vars.

- [ ] **Step 3: Commit if the user asked**

```bash
git add app/sign-up/page.tsx
git commit -m "$(cat <<'EOF'
feat(auth): show Continue with Google on SaaS sign-up

EOF
)"
```

---

### Task 10: `/sign-up/complete` page

**Files:**
- Create: `app/sign-up/complete/page.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient`, `createServiceRoleClient`, `isStandaloneDeployment`, `signOutAction`, `readQuizFromSession`, `apiErrorMessage`, `AuthShell`
- Produces: complete form → POST `/api/auth/complete-google-signup` → `/onboarding/recommendation`

`app/sign-up/layout.tsx` already wraps this route. Standalone with businesses already redirects the whole `/sign-up/*` tree to `/sign-in`. Still guard the page itself.

- [ ] **Step 1: Server guards**

```tsx
export const dynamic = "force-dynamic";

export default async function CompleteGoogleSignupPage() {
  if (isStandaloneDeployment()) {
    redirect("/sign-in");
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect("/sign-in");
  }
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) {
    redirect("/home");
  }
  return <CompleteGoogleSignupForm email={user.email} />;
}
```

Email is passed as a string child/prop — React text, not `dangerouslySetInnerHTML`.

- [ ] **Step 2: Client form**

Copy plan cards, business name, state select, terms checkbox, and `STATES` from `app/sign-up/page.tsx`. Omit password and editable email.

- Email field: `<input type="email" value={email} readOnly />`
- Submit: `POST /api/auth/complete-google-signup` with `{ business_name, state_code, accept_terms, signup_path, onboarding_quiz? }` from `readQuizFromSession()` mapped the same way as email sign-up (`business_type` / `team_size_band` / `priorities`).
- `already_complete: true` → `router.replace("/home")` then `refresh`
- `ok: true` → `router.replace("/onboarding/recommendation")` then `refresh`
- 401 → `router.replace("/sign-in")`
- Sign out: `<form action={signOutAction}>` with a text button “Use a different account”

- [ ] **Step 3: Manual check on local SaaS**

1. `DEPLOYMENT_MODE=saas` (already set). Dev server running.
2. New Google account → lands on `/sign-up/complete`, not `/home`.
3. Submit free plan → `/onboarding/recommendation`.
4. Same Google again → `/home` or onboarding if still incomplete.
5. Existing email/password owner with same Gmail (if already linked) → `/home`, no form.

- [ ] **Step 4: Commit if the user asked**

```bash
git add app/sign-up/complete/page.tsx
git commit -m "$(cat <<'EOF'
feat(auth): collect plan and business details after Google sign-in

EOF
)"
```

---

## Spec coverage

| Spec section | Task |
|--------------|------|
| Google on `/sign-in` and `/sign-up` | 9 (sign-in already exists) |
| Complete fields; email locked; no password | 2, 10 |
| Same provision as email sign-up | 5, 7 |
| Success → `/onboarding/recommendation` | 7, 10 |
| Existing profile → home | 3, 6 |
| Email on another row → `email_taken` | 1, 3, 6, 7 |
| Incomplete blocked from app/APIs | 4, 8 |
| Session email only; strict body | 2, 7 |
| Standalone 403 / hidden Google | 7, 9, 10 |
| Keep Auth user on provision failure | 5 |
| No Auth delete on Google complete | 5, 7 |
| `user_metadata` not used for authz | 7 (optional write only) |
| Tests listed in spec §10 | 1–7 |

## Placeholder scan

No TBD/TODO. Types `GoogleCallbackTarget`, `IncompleteSessionDecision`, `ownerProvisionPlan`, `provisionOwnerBusiness`, `completeGoogleSignupSchema` are defined in the task that introduces them and reused later with the same names.
