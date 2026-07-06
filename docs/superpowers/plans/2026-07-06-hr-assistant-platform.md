# HR Assistant Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a monetised, credit-metered HR Assistant (Hana) with Tier A session chat, daily HR notices, marketplace add-on (RM 20 / 100 credits), settings toggles, and approve/reject leave tools — optimised for non-IT SME owners.

**Architecture:** Extend existing `marketplace_addons` + `credit_ledger` + HR assistant API. New tables `business_agent_settings`, `agent_daily_notices`, `ai_usage`. Server-side entitlement + credit spend before every LLM call. Tier A chat = `sessionStorage` only. Daily notice via Vercel cron + template from `buildHrSnapshot`.

**Tech Stack:** Next.js 15 App Router, Supabase (RLS + RPC), ILMU/OpenAI via `lib/ai/openai.ts`, Zod, existing Marketplace + Settings patterns.

**Design spec:** `docs/superpowers/specs/2026-07-06-hr-assistant-platform-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/00034_hr_assistant_platform.sql` | Tables + RPCs + seed addon |
| `lib/marketplace/entitlements.ts` | `hasActiveAddon`, `requireHrAssistant` |
| `lib/ai/credits.ts` | `spendCredits`, `grantCredits`, slow-mode helper |
| `lib/ai/usage.ts` | `recordAiUsage` → `ai_usage` |
| `lib/ai/hr-daily-notice.ts` | Template notice from snapshot |
| `lib/ai/hr-assistant-tools.ts` | Add `update_leave_status` tool |
| `lib/ai/hr-assistant-prompt.ts` | Name injection + action rules |
| `app/api/hr/assistant/route.ts` | Addon gate + credits + named agent |
| `app/api/settings/ai-agents/hr/route.ts` | GET/PATCH agent settings |
| `app/api/cron/hr-daily-notice/route.ts` | Cron job |
| `components/hr/HrAssistantChat.tsx` | Tier A session + credit meter + New chat |
| `components/hr/HrAssistantGate.tsx` | Marketplace upsell when locked |
| `components/dashboard/agent-notice-card.tsx` | Home/HR notice display |
| `app/(app)/settings/ai-agents/page.tsx` | Wire HR row (replace mock for HR) |
| `app/(app)/hr/assistant/page.tsx` | Gate + settings-aware header |
| `app/(app)/home/page.tsx` | HR notice card |
| `app/(app)/hr/page.tsx` | HR notice on overview |
| `vercel.json` | Add cron schedule |
| `tests/ai/credits.test.ts` | Credit helper tests |
| `tests/ai/hr-assistant-tools.test.ts` | Leave approve tool tests |

---

## Phase A — Marketplace add-on + DB foundation

### Task 1: Migration — core tables and RPCs

**Files:**
- Create: `supabase/migrations/00034_hr_assistant_platform.sql`

- [ ] **Step 1: Add `business_agent_settings`**

```sql
create table public.business_agent_settings (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_slug text not null,
  display_name text not null default 'Hana',
  assistant_enabled boolean not null default true,
  daily_notice_enabled boolean not null default true,
  daily_notice_hour smallint not null default 7
    check (daily_notice_hour between 0 and 23),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, agent_slug)
);
```

- [ ] **Step 2: Add `agent_daily_notices`**

```sql
create table public.agent_daily_notices (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_slug text not null,
  notice_date date not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (business_id, agent_slug, notice_date)
);
```

- [ ] **Step 3: Add `ai_usage`**

```sql
create table public.ai_usage (
  id uuid primary key default extensions.uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_slug text not null,
  trigger_type text not null,
  credits_charged integer not null default 0,
  mode text not null default 'fast' check (mode in ('fast','slow')),
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_myr_estimated numeric(10,4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 4: RLS policies** — tenant SELECT on all three; INSERT `ai_usage` via RPC only; UPDATE `business_agent_settings` owner/manager HR roles.

- [ ] **Step 5: `settings_grant_credits` RPC** (positive delta, no invoice):

```sql
create or replace function public.settings_grant_credits(
  p_business_id uuid,
  p_credits integer,
  p_reason text,
  p_actor_user_id uuid default null
) returns integer ...
```

- [ ] **Step 6: `settings_spend_credits` RPC**:

```sql
-- Returns jsonb: { charged, mode, new_balance }
-- mode = 'fast' if balance >= cost; 'slow' if balance < cost and p_allow_slow
-- If not allow_slow and balance < cost → raise exception 'insufficient_credits'
```

- [ ] **Step 7: Seed marketplace addon**

```sql
insert into public.marketplace_addons (slug, name, short_desc, long_desc, pillar, icon, price_cents, cadence, sort_order)
values (
  'hr-assistant',
  'HR Assistant (Hana)',
  'AI HR staff — leave, team summaries, daily notices',
  'Chat with Hana about your team. 100 AI credits/month included. Record MC and annual leave by asking in plain language.',
  'hr', 'users', 2000, 'monthly', 15
) on conflict (slug) do update set name = excluded.name, price_cents = excluded.price_cents;
```

- [ ] **Step 8: Extend `marketplace_activate_addon`** — after insert, when slug = `hr-assistant`:
  - `settings_grant_credits(business_id, 100, 'hr_assistant_monthly_grant')`
  - upsert `business_agent_settings` (`agent_slug='hr'`, `display_name='Hana'`)

- [ ] **Step 9: Push migration**

Run: `supabase db push --linked`  
Expected: migration applies cleanly

---

### Task 2: Entitlement helpers

**Files:**
- Create: `lib/marketplace/entitlements.ts`
- Create: `lib/marketplace/types-agent.ts` (settings types)

- [ ] **Step 1: Write failing test** `tests/marketplace/entitlements.test.ts`

```typescript
describe("hasActiveAddon", () => {
  it("returns false when no business_addons row", async () => {
    // mock supabase
  });
});
```

- [ ] **Step 2: Implement**

```typescript
export async function hasActiveAddon(
  businessId: string,
  addonSlug: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("business_addons")
    .select("id, marketplace_addons!inner(slug), status")
    .eq("business_id", businessId)
    .eq("marketplace_addons.slug", addonSlug)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}
```

- [ ] **Step 3: `loadBusinessAgentSettings(businessId, agentSlug)`** with defaults if missing.

- [ ] **Step 4: Run tests** — `npm run test -- tests/marketplace/entitlements.test.ts`

---

## Phase B — Credit metering

### Task 3: Credit service layer

**Files:**
- Create: `lib/ai/credits.ts`
- Create: `lib/ai/usage.ts`
- Test: `tests/ai/credits.test.ts`

- [ ] **Step 1: `spendCredits(ctx, { amount, reason, allowSlow })`**

Calls `settings_spend_credits` RPC. Returns `{ mode: 'fast' | 'slow', charged: number, balance: number }`.

- [ ] **Step 2: `grantCredits(businessId, amount, reason)`** — wraps grant RPC (for tests/admin).

- [ ] **Step 3: `recordAiUsage({ businessId, agentSlug, triggerType, creditsCharged, mode, tokensIn, tokensOut })`**

Insert into `ai_usage` via server client (service role or SECURITY DEFINER wrapper).

- [ ] **Step 4: `getCreditBalance(businessId)`** — read `businesses.credit_balance`.

- [ ] **Step 5: Wire into `app/api/hr/assistant/route.ts`**

Before `runHrAssistantChat`:
1. `hasActiveAddon(businessId, 'hr-assistant')` → 403 with marketplace link if false
2. `loadBusinessAgentSettings` → if `!assistant_enabled` → 403
3. Determine cost: 1 credit default; 2 if message likely action (or charge 2 after tool call)
4. `spendCredits` with `allowSlow: true`
5. If `mode === 'slow'`, `await delay(15000 + jitter)` before LLM
6. After LLM, `recordAiUsage` with token counts from response if available

- [ ] **Step 6: Return credit info in API response**

```json
{ "reply": "...", "credits": { "charged": 1, "balance": 77, "mode": "fast" } }
```

- [ ] **Step 7: Tests for spend/grant happy path and insufficient credits**

---

### Task 4: Monthly credit renewal cron

**Files:**
- Create: `app/api/cron/hr-assistant-renewal/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Cron route** — `GET`, verify `CRON_SECRET`, service role

Query `business_addons` joined `marketplace_addons` where slug=`hr-assistant`, status=`active`, `next_charge_at <= now()` (or daily check for due renewals).

For each: `settings_grant_credits(100, 'hr_assistant_monthly_grant')`.

- [ ] **Step 2: Add to vercel.json** — `0 0 * * *` (midnight UTC) or align with billing

- [ ] **Step 3: Manual test** — curl with Bearer CRON_SECRET

---

## Phase C — Agent settings (name + toggles)

### Task 5: Settings API

**Files:**
- Create: `app/api/settings/ai-agents/hr/route.ts`
- Create: `lib/settings/agent-settings-schemas.ts`

- [ ] **Step 1: Zod schema**

```typescript
export const hrAgentSettingsSchema = z.object({
  display_name: z.string().trim().min(1).max(40),
  assistant_enabled: z.boolean(),
  daily_notice_enabled: z.boolean(),
}).strict();
```

- [ ] **Step 2: GET** — owner/manager + `canManageHrCore`; return settings + `addon_active` + `credit_balance`

- [ ] **Step 3: PATCH** — owner only; upsert `business_agent_settings`

- [ ] **Step 4: Tests** `tests/settings/ai-agents-hr.test.ts`

---

### Task 6: Settings UI (HR row only — keep other agents mock for now)

**Files:**
- Modify: `app/(app)/settings/ai-agents/page.tsx`
- Create: `components/settings/HrAgentSettingsCard.tsx`

- [ ] **Step 1: Fetch `/api/settings/ai-agents/hr` on mount**

- [ ] **Step 2: Card UI (non-IT friendly)**

```
[Hana]  HR Assistant
Name: [ text input ]  "What your team calls this helper"
[x] HR chat enabled
[x] Daily HR notice on Home & HR page
Credits: 78 / 100  [ Top up → ]
```

- [ ] **Step 3: Save button → PATCH**

- [ ] **Step 4: Link to Marketplace if `!addon_active`**

---

### Task 7: Named agent in prompts

**Files:**
- Modify: `lib/ai/hr-assistant-prompt.ts`
- Modify: `app/api/hr/assistant/route.ts`

- [ ] **Step 1: `buildHrAssistantRules({ displayName, businessName })`**

- [ ] **Step 2: Pass settings into `runHrAssistantChat`**

- [ ] **Step 3: Update `app/(app)/hr/assistant/page.tsx` header** — load display name server-side

---

## Phase D — Daily HR notice

### Task 8: Notice generator (template-only v1)

**Files:**
- Create: `lib/ai/hr-daily-notice.ts`

- [ ] **Step 1: `buildHrDailyNotice(snapshot, displayName)`**

Returns `{ title, body }` from snapshot KPIs + attention items. Example:

```
title: "HR notice — 6 Jul"
body: "• 1 leave waiting approval\n• Next holiday: ..."
```

No LLM call (0 credits).

- [ ] **Step 2: Unit test** with fixture snapshot

---

### Task 9: Cron + persistence

**Files:**
- Create: `app/api/cron/hr-daily-notice/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: For each tenant** with active `hr-assistant` + `daily_notice_enabled`:

- Resolve business context (service role query)
- `buildPillarSnapshot('hr', ctx)`
- `buildHrDailyNotice`
- Upsert `agent_daily_notices` for `notice_date = today MYT`

- [ ] **Step 2: Schedule `0 23 * * 1-6`** (7am MYT ≈ 23:00 UTC previous day — verify offset)

- [ ] **Step 3: `lib/hr/load.ts` add `loadTodayHrNotice(businessId)`**

---

### Task 10: Notice UI surfaces

**Files:**
- Create: `components/dashboard/agent-notice-card.tsx`
- Modify: `app/(app)/home/page.tsx`
- Modify: `app/(app)/hr/page.tsx`

- [ ] **Step 1: `AgentNoticeCard`** — shows title, body bullets, link to `/hr/assistant`

- [ ] **Step 2: Home page** — if HR addon active + notice exists, render card above module overview

- [ ] **Step 3: HR overview** — `HrInfoBanner` with today's notice body

---

## Phase E — Tier A chat UX (non-IT)

### Task 11: Session persistence + New chat

**Files:**
- Modify: `components/hr/HrAssistantChat.tsx`
- Create: `components/hr/HrAssistantGate.tsx`

- [ ] **Step 1: sessionStorage helpers**

```typescript
const STORAGE_KEY = "bn-hr-assistant-chat-v1";
const MAX_MESSAGES = 20;
function loadSession(): ChatTurn[] { ... }
function saveSession(turns: ChatTurn[]) { ... }
```

- [ ] **Step 2: Hydrate on mount, save on each turn**

- [ ] **Step 3: "New chat" button** — clears turns + storage; plain label, no confirm dialog

- [ ] **Step 4: Credit meter in header**

```
⚡ 78 credits left
```

From API response `credits.balance`.

- [ ] **Step 5: Slow mode message** — when `credits.mode === 'slow'`, show amber helper text

- [ ] **Step 6: `HrAssistantGate`** — if API returns 403 `addon_required`, show:

```
Meet Hana — your HR helper
RM 20/month includes 100 questions
[ Get HR Assistant in Marketplace ]
```

- [ ] **Step 7: Simpler placeholder** — `Message Hana…` (dynamic name prop)

---

## Phase F — Approve / reject leave tool

### Task 12: `update_leave_status` tool

**Files:**
- Modify: `lib/ai/hr-assistant-tools.ts`
- Modify: `lib/ai/hr-assistant-prompt.ts`
- Test: `tests/ai/hr-assistant-tools.test.ts`

- [ ] **Step 1: Add tool definition**

```typescript
{
  name: "update_leave_status",
  parameters: {
    employee_name: string,
    decision: "approved" | "rejected",
    decision_note?: string
  }
}
```

- [ ] **Step 2: `executeUpdateLeaveStatus(ctx, args)`**

1. Resolve employee by name (reuse matcher)
2. Find latest `pending` leave for employee in tenant
3. If none → error result
4. Update same fields as `PATCH /api/hr/leave/[id]/status`
5. Return success with leave details

- [ ] **Step 3: Register in `executeHrAssistantTool`**

- [ ] **Step 4: Prompt rules** — only when user explicitly asks to approve/reject

- [ ] **Step 5: Charge 2 credits when tool invoked** (adjust in route post-tool detection)

- [ ] **Step 6: Tests** — approve, reject, no pending leave, ambiguous employee

---

### Task 13: Suggested prompts update

**Files:**
- Modify: `lib/ai/hr-assistant-prompt.ts`
- Modify: `components/hr/HrAssistantChat.tsx`

- [ ] Add pills:
  - "Approve Aisyah's MC leave"
  - "Who is on leave today?"
  - "New chat" stays separate button

---

## Phase G — Integration polish

### Task 14: Marketplace copy + pillar gate

**Files:**
- Modify: `components/marketplace/MarketplaceView.tsx` (if needed for HR pillar eligibility)
- Modify: `lib/pillars/index.ts` — document HR assistant as add-on

- [ ] Ensure `addonEligibility` allows `hr-assistant` when HR module unlocked (Growth+)

---

### Task 15: Middleware / nav

**Files:**
- Modify: `app/(app)/hr/assistant/page.tsx`

- [ ] Page loads gate server-side: check addon → pass prop to client gate component

- [ ] No nav changes needed (already in sidebar)

---

### Task 16: Documentation

**Files:**
- Modify: `docs/glossary.md` — Hana, HR Assistant credits
- Modify: `.env.example` — note CRON routes

---

## Verification checklist

Run after all tasks:

```bash
npm run type-check
npm run test
```

Manual:

- [ ] Activate `hr-assistant` in Marketplace → balance +100
- [ ] Chat works, credits decrement
- [ ] At 0 credits → slow mode still replies
- [ ] Settings rename to "Siti" → header updates
- [ ] Toggle daily notice off → cron skips (verify no new row)
- [ ] Toggle on → tomorrow notice appears on Home + HR
- [ ] "New chat" clears thread
- [ ] Tab close → chat gone (Tier A)
- [ ] "Approve Aisyah leave" works when pending exists
- [ ] User without addon sees marketplace upsell, not raw 403

---

## Execution order (recommended)

```
A1 migration → A2 entitlements → B3 credits → B4 renewal cron
→ C5 settings API → C6 settings UI → C7 named prompts
→ D8 notice gen → D9 cron → D10 UI
→ E11 chat UX
→ F12 approve tool → F13 prompts
→ G14–G16 polish
```

**Estimated effort:** 4–6 dev days for one engineer.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-06-hr-assistant-platform.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement phases sequentially in this session with checkpoints

Which approach do you want?
