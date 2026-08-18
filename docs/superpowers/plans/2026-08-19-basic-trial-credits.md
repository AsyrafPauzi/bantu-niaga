# 7-day Basic Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-serve trial is 7-day Basic with 20 credits; unused bundle credits die when the trial ends; paying any paid plan keeps leftover trial credits and adds that plan’s monthly bundle.

**Architecture:** Keep `tier` / `subscription_status` / `credit_balance` / `credit_topup_balance`. Add `self_serve_trial_used_at` so a business can trial once. Grant 20 via `basic_trial_grant`, not Basic’s 60. Expiry cron wipes bundle credits. `settings_change_tier` already stacks the paid bundle on leftover balance — do not change that grant. Free users see a toolbar that calls `settings_start_basic_trial`.

**Tech Stack:** Next.js 15 App Router, Vitest, Postgres RPCs, existing `settings_grant_credits` / `settings_issue_subscription_invoice`.

**Spec:** `docs/superpowers/specs/2026-08-19-basic-trial-credits-design.md`

## Global Constraints

- Trial product is **Basic only**. Never provision new self-serve trials as Solo (`micro`).
- `TRIAL_RENEWAL_DAYS = 7`. `BASIC_TRIAL_CREDITS = 20`. Grant reason `basic_trial_grant`.
- Paid monthly bundles stay Basic 60 / Solo 120 / SME 180 / Small 360.
- Convert during trial: leftover credits + destination bundle. Do **not** zero credits in `settings_change_tier`.
- Expiry: `credit_balance = coalesce(credit_topup_balance, 0)`. Do not grant Free credits.
- Do **not** rewrite `subscription_renewal_at` for existing `micro` + `trial` rows in the migration.
- Copy says **7-day Basic trial**, never “Solo trial” for this offer.
- Toolbar and start-trial: SaaS only; owner only; once per business (`self_serve_trial_used_at`).
- Do not authorize on `user_metadata`.
- Generic API errors; log details server-side.
- Commits only when the user asks, unless they chose an execution mode that includes commits.

## File map

| File | Role |
|------|------|
| `lib/settings/subscription-billing.ts` | `TRIAL_RENEWAL_DAYS = 7`, `BASIC_TRIAL_CREDITS = 20` |
| `lib/settings/basic-trial.ts` | `shouldOfferBasicTrial` |
| `lib/settings/subscription-credits.ts` | `grantBasicTrialCredits` |
| `lib/auth/provision-owner-business.ts` | Basic + 7 days + 20 credits + stamp `self_serve_trial_used_at` |
| `supabase/migrations/20260819140000_basic_trial.sql` | Column, backfill, expiry wipe, start RPC |
| `app/api/settings/subscription/start-basic-trial/route.ts` | Owner POST wrapper |
| `components/settings/BasicTrialBanner.tsx` | Free upsell toolbar |
| `app/(app)/layout.tsx` | Load eligibility, render banner |
| Sign-up / complete / guide / sign-in / forgot-password | Copy |
| `docs/pricing-plan.md` | §13 self-serve trial row |
| Tests under `tests/auth/` and `tests/settings/` | |

Do **not** edit `settings_change_tier` credit logic. Convert leftover + plan grant already works.

---

### Task 1: Constants, plan mapping, toolbar predicate

**Files:**
- Modify: `lib/settings/subscription-billing.ts`
- Create: `lib/settings/basic-trial.ts`
- Modify: `lib/auth/provision-owner-business.ts` (`ownerProvisionPlan` only in this task)
- Test: `tests/settings/subscription-billing.test.ts`
- Test: `tests/settings/pricing-plan.test.ts`
- Test: `tests/auth/provision-owner-plan.test.ts`
- Test: `tests/settings/basic-trial.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `export const TRIAL_RENEWAL_DAYS = 7`
  - `export const BASIC_TRIAL_CREDITS = 20`
  - `export function ownerProvisionPlan(signupPath: SignupPath): { tier: "starter" \| "basic"; subscriptionStatus: "active" \| "trial"; trialDays: 0 \| 7; grantCredits: boolean; periodLabel: string }`
  - `export function shouldOfferBasicTrial(input: { isSaas: boolean; role: string; tier: string; subscriptionStatus: string; selfServeTrialUsedAt: string \| null }): boolean`

- [ ] **Step 1: Write the failing tests**

In `tests/settings/subscription-billing.test.ts` and `tests/settings/pricing-plan.test.ts`, change the trial assertion:

```ts
it("uses 30-day free cycle and 7-day trial", () => {
  expect(MONTHLY_RENEWAL_DAYS).toBe(30);
  expect(TRIAL_RENEWAL_DAYS).toBe(7);
});
```

In `tests/auth/provision-owner-plan.test.ts`:

```ts
it("maps starter_trial to basic trial with credits", () => {
  const plan = ownerProvisionPlan("starter_trial");
  expect(plan.tier).toBe("basic");
  expect(plan.subscriptionStatus).toBe("trial");
  expect(plan.grantCredits).toBe(true);
  expect(plan.trialDays).toBe(7);
  expect(plan.periodLabel).toBe("7-day Basic trial");
});
```

Create `tests/settings/basic-trial.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldOfferBasicTrial } from "@/lib/settings/basic-trial";

describe("shouldOfferBasicTrial", () => {
  const eligible = {
    isSaas: true,
    role: "owner",
    tier: "starter",
    subscriptionStatus: "active",
    selfServeTrialUsedAt: null as string | null,
  };

  it("is true for SaaS Free owner who never trialed", () => {
    expect(shouldOfferBasicTrial(eligible)).toBe(true);
  });

  it("is false when trial was already used", () => {
    expect(
      shouldOfferBasicTrial({
        ...eligible,
        selfServeTrialUsedAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("is false for standalone, non-owner, trial, or paid tier", () => {
    expect(shouldOfferBasicTrial({ ...eligible, isSaas: false })).toBe(false);
    expect(shouldOfferBasicTrial({ ...eligible, role: "manager" })).toBe(false);
    expect(
      shouldOfferBasicTrial({ ...eligible, subscriptionStatus: "trial" }),
    ).toBe(false);
    expect(shouldOfferBasicTrial({ ...eligible, tier: "basic" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/settings/subscription-billing.test.ts tests/settings/pricing-plan.test.ts tests/auth/provision-owner-plan.test.ts tests/settings/basic-trial.test.ts`

Expected: FAIL (`TRIAL_RENEWAL_DAYS` still 14; `ownerProvisionPlan` still `micro` / 14; `shouldOfferBasicTrial` not exported).

- [ ] **Step 3: Implement constants, plan, predicate**

`lib/settings/subscription-billing.ts` — keep `TRIAL_RENEWAL_DAYS` comment as paid trial length; set to `7`; add:

```ts
/** Credits granted at Basic trial start (not the Basic monthly bundle). */
export const BASIC_TRIAL_CREDITS = 20;
```

`lib/settings/basic-trial.ts`:

```ts
export function shouldOfferBasicTrial(input: {
  isSaas: boolean;
  role: string;
  tier: string;
  subscriptionStatus: string;
  selfServeTrialUsedAt: string | null;
}): boolean {
  if (!input.isSaas) return false;
  if (input.role !== "owner") return false;
  if (input.tier !== "starter") return false;
  if (input.subscriptionStatus !== "active") return false;
  if (input.selfServeTrialUsedAt) return false;
  return true;
}
```

`ownerProvisionPlan` trial branch:

```ts
export function ownerProvisionPlan(signupPath: SignupPath): {
  tier: "starter" | "basic";
  subscriptionStatus: "active" | "trial";
  trialDays: 0 | 7;
  grantCredits: boolean;
  periodLabel: string;
} {
  if (signupPath === "free") {
    return {
      tier: "starter",
      subscriptionStatus: "active",
      trialDays: 0,
      grantCredits: false,
      periodLabel: `${subscriptionPeriodLabel()} — Free plan`,
    };
  }
  return {
    tier: "basic",
    subscriptionStatus: "trial",
    trialDays: 7,
    grantCredits: true,
    periodLabel: "7-day Basic trial",
  };
}
```

Leave `grantTierBundledCredits(..., "micro")` in `provisionOwnerBusiness` for the next task — this task only changes `ownerProvisionPlan`. TypeScript will fail until Task 2 if `tier` no longer includes `"micro"`; fix the insert types as part of this function change only.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/settings/subscription-billing.test.ts tests/settings/pricing-plan.test.ts tests/auth/provision-owner-plan.test.ts tests/settings/basic-trial.test.ts`

Expected: PASS. If `tsc` complains about `"micro"` in provision, proceed to Task 2 in the same session.

- [ ] **Step 5: Commit** (only if execution mode includes commits)

```bash
git add lib/settings/subscription-billing.ts lib/settings/basic-trial.ts lib/auth/provision-owner-business.ts tests/settings/subscription-billing.test.ts tests/settings/pricing-plan.test.ts tests/auth/provision-owner-plan.test.ts tests/settings/basic-trial.test.ts
git commit -m "$(cat <<'EOF'
feat: map self-serve trial to 7-day Basic

Keep Free as starter with no credits; starter_trial is Basic for seven days.
EOF
)"
```

---

### Task 2: Grant 20 trial credits on provision

**Files:**
- Modify: `lib/settings/subscription-credits.ts`
- Modify: `lib/auth/provision-owner-business.ts` (insert + grant)
- Test: `tests/settings/subscription-credits-trial.test.ts`

**Interfaces:**
- Consumes: `BASIC_TRIAL_CREDITS` from Task 1; `ownerProvisionPlan().grantCredits`
- Produces:
  - `export const BASIC_TRIAL_GRANT_REASON = "basic_trial_grant"`
  - `export async function grantBasicTrialCredits(businessId: string, actorUserId?: string \| null, client?: SupabaseClient): Promise<number>`

- [ ] **Step 1: Write the failing test**

Create `tests/settings/subscription-credits-trial.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

describe("grantBasicTrialCredits", () => {
  it("grants BASIC_TRIAL_CREDITS with reason basic_trial_grant", async () => {
    vi.resetModules();
    const rpc = vi.fn(async () => ({ data: 20, error: null }));
    vi.doMock("@/lib/ai/credits", () => ({ grantCredits: vi.fn() }));
    const { grantBasicTrialCredits } = await import(
      "@/lib/settings/subscription-credits"
    );
    const { BASIC_TRIAL_CREDITS } = await import(
      "@/lib/settings/subscription-billing"
    );
    const client = { rpc };
    const balance = await grantBasicTrialCredits("biz-1", "user-1", client as never);
    expect(balance).toBe(20);
    expect(BASIC_TRIAL_CREDITS).toBe(20);
    expect(rpc).toHaveBeenCalledWith("settings_grant_credits", {
      p_business_id: "biz-1",
      p_credits: 20,
      p_reason: "basic_trial_grant",
      p_actor_user_id: "user-1",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/settings/subscription-credits-trial.test.ts`

Expected: FAIL (`grantBasicTrialCredits` is not exported).

- [ ] **Step 3: Implement grant + wire provision**

Add to `lib/settings/subscription-credits.ts`:

```ts
import { BASIC_TRIAL_CREDITS } from "@/lib/settings/subscription-billing";

export const BASIC_TRIAL_GRANT_REASON = "basic_trial_grant";

export async function grantBasicTrialCredits(
  businessId: string,
  actorUserId?: string | null,
  client?: SupabaseClient,
): Promise<number> {
  const amount = BASIC_TRIAL_CREDITS;
  if (client) {
    const { data, error } = await client.rpc("settings_grant_credits", {
      p_business_id: businessId,
      p_credits: amount,
      p_reason: BASIC_TRIAL_GRANT_REASON,
      p_actor_user_id: actorUserId ?? null,
    });
    if (error) throw new Error(error.message);
    return data as number;
  }
  return grantCredits(businessId, amount, BASIC_TRIAL_GRANT_REASON, actorUserId);
}
```

In `provisionOwnerBusiness` insert, add:

```ts
self_serve_trial_used_at:
  input.signupPath === "starter_trial" ? new Date().toISOString() : null,
```

Replace the trial grant block:

```ts
if (plan.grantCredits) {
  try {
    await grantBasicTrialCredits(businessRow.id, input.authUserId, admin);
  } catch (creditError) {
    await rollbackProvision(admin, input.authUserId, businessRow.id);
    return {
      ok: false,
      error: "credit_grant_failed",
      message:
        creditError instanceof Error
          ? creditError.message
          : "Could not grant trial credits",
      status: 500,
    };
  }
}
```

Remove the `grantTierBundledCredits(..., "micro")` call. Keep `grantTierBundledCredits` import only if unused — then drop it.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/settings/subscription-credits-trial.test.ts tests/auth/provision-owner-plan.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit** (if execution mode includes commits)

```bash
git add lib/settings/subscription-credits.ts lib/auth/provision-owner-business.ts tests/settings/subscription-credits-trial.test.ts
git commit -m "$(cat <<'EOF'
feat: grant 20 credits on Basic trial sign-up

Avoid the Basic monthly bundle of 60 and stamp self_serve_trial_used_at.
EOF
)"
```

---

### Task 3: Migration — column, backfill, expiry wipe, start RPC

**Files:**
- Create: `supabase/migrations/20260819140000_basic_trial.sql`

**Interfaces:**
- Consumes: `BASIC_TRIAL_CREDITS = 20`, 7-day interval
- Produces:
  - Column `public.businesses.self_serve_trial_used_at timestamptz`
  - Updated `subscription_process_renewals()` trial branch
  - `public.settings_start_basic_trial(p_business_id uuid, p_user_id uuid)`

- [ ] **Step 1: Create the migration file** (no live DB in Vitest; review SQL against the spec before push)

```sql
-- 7-day Basic self-serve trial. Do not rewrite existing trial renewal timestamps.

alter table public.businesses
  add column if not exists self_serve_trial_used_at timestamptz;

comment on column public.businesses.self_serve_trial_used_at is
  'When this business started a self-serve trial. Null = toolbar eligible (Free only).';

update public.businesses
   set self_serve_trial_used_at = coalesce(self_serve_trial_used_at, now())
 where subscription_status = 'trial'
   and self_serve_trial_used_at is null;

update public.businesses b
   set self_serve_trial_used_at = coalesce(b.self_serve_trial_used_at, a.created_at)
  from public.audit_log a
 where a.entity_id = b.id
   and a.action = 'auth.sign_up'
   and (
     a.diff->>'signup_path' = 'starter_trial'
     or coalesce((a.diff->>'trial_days')::int, 0) > 0
   )
   and b.self_serve_trial_used_at is null;

create or replace function public.subscription_process_renewals()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_count integer := 0;
  v_label text;
  v_next interval;
  v_credits integer;
begin
  for v_row in
    select id, tier, subscription_status, subscription_renewal_at,
           credit_balance, credit_topup_balance
      from public.businesses
     where subscription_renewal_at is not null
       and subscription_renewal_at <= now()
       and subscription_status in ('active', 'trial')
  loop
    if v_row.subscription_status = 'trial' then
      v_label := 'Trial ended';
      perform public.settings_issue_subscription_invoice(
        v_row.id,
        null,
        v_label,
        0
      );
      update public.businesses
         set tier = 'starter',
             subscription_status = 'active',
             subscription_renewal_at = now() + interval '30 days',
             credit_balance = coalesce(credit_topup_balance, 0)
       where id = v_row.id;
    else
      v_label := to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY') ||
        case when v_row.tier = 'starter' then ' — Free plan' else '' end;

      perform public.settings_issue_subscription_invoice(
        v_row.id,
        null,
        v_label,
        public.subscription_tier_amount_myr(v_row.tier)
      );

      v_credits := public.subscription_tier_bundled_credits(v_row.tier);
      if v_credits > 0 then
        perform public.settings_grant_credits(
          v_row.id,
          v_credits,
          'subscription_monthly_grant',
          null
        );
      end if;

      v_next := interval '30 days';
      update public.businesses
         set subscription_renewal_at = now() + v_next
       where id = v_row.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.settings_start_basic_trial(
  p_business_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tier text;
  v_status text;
  v_used timestamptz;
  v_updated integer;
begin
  select tier, subscription_status, self_serve_trial_used_at
    into v_tier, v_status, v_used
    from public.businesses
   where id = p_business_id
   for update;

  if not found then
    raise exception 'invalid_status';
  end if;

  if v_used is not null then
    raise exception 'trial_already_used';
  end if;

  if v_tier is distinct from 'starter' or v_status is distinct from 'active' then
    raise exception 'invalid_status';
  end if;

  update public.businesses
     set tier = 'basic',
         subscription_status = 'trial',
         subscription_renewal_at = now() + interval '7 days',
         self_serve_trial_used_at = now()
   where id = p_business_id
     and tier = 'starter'
     and subscription_status = 'active'
     and self_serve_trial_used_at is null;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'trial_already_used';
  end if;

  perform public.settings_grant_credits(
    p_business_id,
    20,
    'basic_trial_grant',
    p_user_id
  );

  perform public.settings_issue_subscription_invoice(
    p_business_id,
    p_user_id,
    '7-day Basic trial',
    0
  );

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    p_business_id,
    p_user_id,
    'subscription.basic_trial_start',
    'business',
    p_business_id,
    jsonb_build_object('credits_granted', 20, 'trial_days', 7)
  );
end;
$$;

revoke all on function public.settings_start_basic_trial(uuid, uuid) from public;
grant execute on function public.settings_start_basic_trial(uuid, uuid) to authenticated;
```

Copy the **paid** (`else`) branch from the current `subscription_process_renewals` in `supabase/migrations/20260807120000_pricing_plan_implementation.sql` so paid renewals stay identical. Only the trial branch and the `select` list change.

- [ ] **Step 2: Confirm the migration does not set `subscription_renewal_at` except inside the cron function and start RPC**

Search the new file for `subscription_renewal_at`. Allowed: cron trial/paid updates; start RPC. Forbidden: a bulk `update businesses set subscription_renewal_at` for existing trials.

- [ ] **Step 3: Apply when executing against the linked project** (operator / later session)

Run: `npx supabase db push --linked --yes`

If remote history conflicts, repair as before — do not revert applied schema.

- [ ] **Step 4: Commit** (if execution mode includes commits)

```bash
git add supabase/migrations/20260819140000_basic_trial.sql
git commit -m "$(cat <<'EOF'
feat: add Basic trial column, expiry credit wipe, and start RPC

Stamp one trial per business and drop unused bundle credits when trial ends.
EOF
)"
```

---

### Task 4: Start-trial API

**Files:**
- Create: `app/api/settings/subscription/start-basic-trial/route.ts`
- Test: `tests/settings/start-basic-trial-api.test.ts`

**Interfaces:**
- Consumes: `settings_start_basic_trial` RPC from Task 3; `getCurrentUser`; `isStandaloneDeployment`; `enforceAuthRateLimit`
- Produces: `POST` JSON `{ ok: true }` on success; 401 / 403 / 409 / 429 / 500

- [ ] **Step 1: Write the failing tests**

Create `tests/settings/start-basic-trial-api.test.ts` following the profile-api mock style:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError, type CurrentUser } from "@/lib/auth/current-user";

const OWNER: CurrentUser = {
  id: "00000000-0000-0000-0000-0000000000aa",
  role: "owner",
  businessId: "00000000-0000-0000-0000-000000000bbb",
  isStub: false,
};

async function loadRoute(opts: {
  user?: CurrentUser | "unauthorized";
  standalone?: boolean;
  rpcError?: { message: string } | null;
}) {
  vi.resetModules();
  vi.doMock("@/lib/platform/deployment", () => ({
    isStandaloneDeployment: () => opts.standalone === true,
  }));
  vi.doMock("@/lib/auth/current-user", async () => {
    const actual = await vi.importActual<typeof import("@/lib/auth/current-user")>(
      "@/lib/auth/current-user",
    );
    return {
      ...actual,
      getCurrentUser: async () => {
        if (opts.user === "unauthorized") throw new UnauthorizedError("unauthenticated");
        return opts.user ?? OWNER;
      },
    };
  });
  const rpc = vi.fn(async () => ({
    data: null,
    error: opts.rpcError ?? null,
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: async () => ({ rpc }),
  }));
  const route = await import(
    "@/app/api/settings/subscription/start-basic-trial/route"
  );
  return { POST: route.POST, rpc };
}

function post() {
  return new Request("http://localhost/api/settings/subscription/start-basic-trial", {
    method: "POST",
  });
}

describe("POST /api/settings/subscription/start-basic-trial", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 when unauthenticated", async () => {
    const { POST } = await loadRoute({ user: "unauthorized" });
    const res = await POST(post());
    expect(res.status).toBe(401);
  });

  it("returns 403 for standalone", async () => {
    const { POST } = await loadRoute({ standalone: true });
    const res = await POST(post());
    expect(res.status).toBe(403);
  });

  it("returns 403 for non-owner", async () => {
    const { POST } = await loadRoute({
      user: { ...OWNER, role: "manager" },
    });
    const res = await POST(post());
    expect(res.status).toBe(403);
  });

  it("returns 409 when RPC says trial_already_used", async () => {
    const { POST } = await loadRoute({
      rpcError: { message: "trial_already_used" },
    });
    const res = await POST(post());
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: "trial_already_used" });
  });

  it("returns 200 and calls RPC with session business id", async () => {
    const { POST, rpc } = await loadRoute({});
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("settings_start_basic_trial", {
      p_business_id: OWNER.businessId,
      p_user_id: OWNER.id,
    });
  });
});
```

If `CurrentUser.role` is a union, use `"staff"` or whatever the type allows instead of `"manager"` — match `lib/auth/current-user.ts`.

Ignore JSON body (no client-supplied credits/tier). Empty POST is fine.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/settings/start-basic-trial-api.test.ts`

Expected: FAIL (route missing).

- [ ] **Step 3: Implement the route**

```ts
import { NextResponse } from "next/server";
import { enforceAuthRateLimit } from "@/lib/api/auth-rate-limit";
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { isStandaloneDeployment } from "@/lib/platform/deployment";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rl = enforceAuthRateLimit(
    request,
    "billing.start-basic-trial",
    5,
    60 * 60 * 1000,
  );
  if (!rl.ok) return rl.response;

  if (isStandaloneDeployment()) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

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

  if (user.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("settings_start_basic_trial", {
    p_business_id: user.businessId,
    p_user_id: user.id,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("trial_already_used")) {
      return NextResponse.json({ error: "trial_already_used" }, { status: 409 });
    }
    if (message.includes("invalid_status")) {
      return NextResponse.json({ error: "invalid_status" }, { status: 409 });
    }
    logger.error("start_basic_trial_failed", { message });
    return NextResponse.json({ error: "start_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
```

Do not parse a body. Do not accept `tier` or `credits` from the client.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/settings/start-basic-trial-api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit** (if execution mode includes commits)

```bash
git add app/api/settings/subscription/start-basic-trial/route.ts tests/settings/start-basic-trial-api.test.ts
git commit -m "$(cat <<'EOF'
feat: add owner API to start the 7-day Basic trial

Reject standalone and non-owners; map RPC trial_already_used to 409.
EOF
)"
```

---

### Task 5: Free-plan toolbar

**Files:**
- Create: `components/settings/BasicTrialBanner.tsx` (client)
- Create: `components/settings/BasicTrialBannerHost.tsx` (server)
- Modify: `app/(app)/layout.tsx`
- Test: already covered by `shouldOfferBasicTrial` in Task 1

**Interfaces:**
- Consumes: `shouldOfferBasicTrial`; layout loads `tier, subscription_status, self_serve_trial_used_at`; `POST /api/settings/subscription/start-basic-trial`
- Produces: dismissible banner; localStorage key `niagax.basic-trial-banner-dismissed`

- [ ] **Step 1: Implement the client banner**

`components/settings/BasicTrialBanner.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";

const STORAGE_KEY = "niagax.basic-trial-banner-dismissed";

export function BasicTrialBanner() {
  const router = useRouter();
  const [hidden, setHidden] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore quota */
    }
    setHidden(true);
  }

  async function startTrial() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/subscription/start-basic-trial", {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof json.error === "string"
            ? json.error
            : "Could not start the trial.",
        );
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not start the trial.");
      setPending(false);
    }
  }

  return (
    <div className="flex items-start gap-3 border-b border-brand-200 bg-brand-50 px-4 py-3 text-sm text-ink dark:border-brand-800 dark:bg-brand-900/30 dark:text-cream-100">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Try Basic for 7 days</p>
        <p className="mt-0.5 text-ink-muted dark:text-cream-400">
          20 AI credits. No card. Upgrade to Basic, Solo, or another paid plan any time.
        </p>
        {error ? <p className="mt-1 text-status-danger">{error}</p> : null}
        <button
          type="button"
          onClick={() => void startTrial()}
          disabled={pending}
          className="mt-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? "Starting…" : "Start 7-day Basic trial"}
        </button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded p-1 text-ink-muted hover:bg-brand-100 dark:hover:bg-brand-800"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

Map `trial_already_used` / `invalid_status` to “This business already used its trial.” in the error string if `json.error` is one of those codes.

- [ ] **Step 2: Server host + layout**

`components/settings/BasicTrialBannerHost.tsx`:

```tsx
import { getCurrentUser, UnauthorizedError } from "@/lib/auth/current-user";
import { isSaasDeployment } from "@/lib/platform/deployment";
import { shouldOfferBasicTrial } from "@/lib/settings/basic-trial";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BasicTrialBanner } from "./BasicTrialBanner";

export async function BasicTrialBannerHost() {
  try {
    const user = await getCurrentUser();
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("businesses")
      .select("tier, subscription_status, self_serve_trial_used_at")
      .eq("id", user.businessId)
      .maybeSingle();
    if (
      !shouldOfferBasicTrial({
        isSaas: isSaasDeployment(),
        role: user.role,
        tier: data?.tier ?? "starter",
        subscriptionStatus: data?.subscription_status ?? "active",
        selfServeTrialUsedAt: data?.self_serve_trial_used_at ?? null,
      })
    ) {
      return null;
    }
    return <BasicTrialBanner />;
  } catch (e) {
    if (e instanceof UnauthorizedError) return null;
    throw e;
  }
}
```

In `app/(app)/layout.tsx`, next to `<ImpersonationBanner />`:

```tsx
<ImpersonationBanner />
<BasicTrialBannerHost />
```

Extend the existing `businesses` select in layout **or** keep a separate query in the host (preferred — do not widen the layout select if it would mix concerns). Host has its own query.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS (or only pre-existing errors unrelated to these files).

- [ ] **Step 4: Commit** (if execution mode includes commits)

```bash
git add components/settings/BasicTrialBanner.tsx components/settings/BasicTrialBannerHost.tsx app/\(app\)/layout.tsx
git commit -m "$(cat <<'EOF'
feat: show Basic trial toolbar on eligible Free accounts

Owners who never used a self-serve trial can start seven days from the app chrome.
EOF
)"
```

---

### Task 6: Copy + pricing doc

**Files:**
- Modify: `app/sign-up/page.tsx`
- Modify: `app/sign-up/complete/complete-form.tsx`
- Modify: `app/sign-up/guide/page.tsx`
- Modify: `app/sign-in/page.tsx`
- Modify: `app/forgot-password/page.tsx`
- Modify: `docs/pricing-plan.md` (§13)
- Modify: `docs/superpowers/specs/2026-08-19-basic-trial-credits-design.md` status line

**Interfaces:**
- Consumes: none
- Produces: user-visible **7-day Basic trial** copy; `signup_path` enum unchanged (`free` | `starter_trial`)

- [ ] **Step 1: Replace copy**

Exact replacements:

| Location | From | To |
|----------|------|-----|
| `app/sign-up/page.tsx` heading | `Start your 14-day Solo trial.` | `Start your 7-day Basic trial.` |
| `app/sign-up/page.tsx` subcopy | `14-day Solo trial · all six modules · upgrade any time.` | `7-day Basic trial · 20 AI credits · upgrade any time.` |
| `app/sign-up/page.tsx` card title | `14-day Solo trial` | `7-day Basic trial` |
| `app/sign-up/page.tsx` card sub | `Admin + Operations modules` | `Admin, Sales, and Finance · 20 credits` |
| `app/sign-up/complete/complete-form.tsx` | same heading + card title `14-day Solo trial` | `7-day Basic trial`; card sub `Admin, Sales, and Finance · 20 credits` |
| `app/sign-up/guide/page.tsx` | `Start 14-day Solo trial` | `Start 7-day Basic trial` |
| `app/sign-up/guide/page.tsx` | `Try Solo trial instead` | `Try Basic trial instead` |
| `app/sign-in/page.tsx` | `Start a 14-day trial` | `Start a 7-day Basic trial` |
| `app/forgot-password/page.tsx` | `Start a 14-day trial` | `Start a 7-day Basic trial` |

`docs/pricing-plan.md` §13 row:

```
| Self-serve paid trial | **7 days on Basic only** — 20 credits. Unused bundle credits expire when the trial ends. Subscribe to Basic, Solo, SME, or Small during trial: leftover credits + that plan’s monthly bundle. Existing 14-day Solo trials keep their clock; expiry uses the same credit wipe. |
```

Spec status: `Approved, plan ready (`docs/superpowers/plans/2026-08-19-basic-trial-credits.md`)`.

Grep the repo (except historical google-signup plan/spec) for `14-day Solo` and `Start a 14-day trial` and update remaining **live UI** strings.

- [ ] **Step 2: Grep check**

Run: `rg -n "14-day Solo|Start a 14-day trial" app components lib --glob '!docs/**'`

Expected: no matches in `app/` or `components/`.

- [ ] **Step 3: Commit** (if execution mode includes commits)

```bash
git add app/sign-up/page.tsx app/sign-up/complete/complete-form.tsx app/sign-up/guide/page.tsx app/sign-in/page.tsx app/forgot-password/page.tsx docs/pricing-plan.md docs/superpowers/specs/2026-08-19-basic-trial-credits-design.md
git commit -m "$(cat <<'EOF'
copy: describe the 7-day Basic trial instead of Solo

Keep the starter_trial signup path; only the product and wording change.
EOF
)"
```

---

### Task 7: Verify

**Files:** none new

- [ ] **Step 1: Run focused tests**

Run:

```
npx vitest run tests/auth/provision-owner-plan.test.ts tests/settings/subscription-billing.test.ts tests/settings/pricing-plan.test.ts tests/settings/basic-trial.test.ts tests/settings/subscription-credits-trial.test.ts tests/settings/start-basic-trial-api.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no new errors from these files.

- [ ] **Step 3: Operator follow-up** (do not skip when going live)

1. `npx supabase db push --linked --yes` for `20260819140000_basic_trial.sql`.
2. Confirm a current `micro` + `trial` row still has the same `subscription_renewal_at`.
3. Sign up Free → toolbar → start trial → 20 credits, `tier=basic`, `trial`.
4. Billing: switch to Solo → leftover + 120.
5. (Staging) expire a trial → Free and bundle credits 0.

---

## Spec coverage

| Spec section | Task |
|--------------|------|
| 7-day Basic trial at sign-up | 1, 2, 6 |
| 20 credits, not 60 | 2, 3 RPC |
| Expiry wipes bundle, keeps top-up | 3 |
| Convert leftover + any paid plan | existing `settings_change_tier` (explicit non-change) |
| Free + trial at sign-up | 6 (copy only; both cards stay) |
| Toolbar once per business | 1, 4, 5 |
| Grandfather Solo clocks | 3 (no renewal rewrite) |
| Copy | 6 |
| Security / rate limit / owner | 4 |

## Placeholder scan

No TBD / “handle edge cases” / “similar to Task N” left in task steps.
