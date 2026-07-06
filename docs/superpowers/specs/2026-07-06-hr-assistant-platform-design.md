# HR Assistant Platform — Design Spec

**Date:** 2026-07-06  
**Status:** Approved for planning (user request: all phases, Tier A chat history, non-IT UX)

---

## 1. Problem

The HR Assistant chat works technically but is not a product:

- No marketplace paywall (RM 20/month)
- No credit metering or top-up path
- No daily HR notice for owners
- No per-tenant agent name/personality
- Settings → AI Agents page is mock data
- Chat has no “new conversation” affordance for casual users

---

## 2. Goals

| Goal | Success criteria |
|------|------------------|
| Monetise HR AI | Owner activates **HR Assistant** add-on (RM 20/mo) from Marketplace |
| Fair usage | **100 credits/month** bundled; top-up without forced churn |
| Simple UX | One chat thread, big buttons, plain BM/EN — no IT jargon |
| Light system | **Tier A** chat only (browser session, no DB chat archive) |
| Staff-like agent | Customisable name (default **Hana**), daily HR notice toggle |
| Real HR actions | Create leave (done), approve/reject leave (Phase F) |

---

## 3. Non-goals (v1)

- Multi-tab chat history / searchable archive (Tier B/C)
- Auto-billing top-up on card
- Open-ended Boardroom-style chat for HR
- Payroll, roster, legal advice
- Per-message token display to end users

---

## 4. Product model

### 4.1 Marketplace add-on

| Field | Value |
|-------|-------|
| Slug | `hr-assistant` |
| Name | HR Assistant (Hana) |
| Price | RM 20 / month (`price_cents: 2000`) |
| Pillar | `hr` |
| Cadence | `monthly` |
| Requires | Growth+ plan with HR module unlocked |

**On first activation (owner):**

1. `business_addons` row → `active`
2. Grant **+100 credits** (`credit_ledger`, `reason: 'hr_assistant_monthly_grant'`)
3. Create default `business_agent_settings` row (`display_name: 'Hana'`, notices ON)

**Monthly renewal:** Cron grants +100 credits on `next_charge_at` (same reason). Monthly grant does **not** roll over (use docs policy). Top-up credits **do** roll over.

### 4.2 Credit costs

| Action | Credits | Notes |
|--------|--------:|-------|
| HR chat (Q&A) | 1 | One user message + reply |
| HR action (create/approve leave) | 2 | Includes tool round-trip |
| Daily HR notice | 0 | Included in subscription |
| Slow mode at 0 balance | 0 | 15–20s delay, still works |

**Economics (observed ILMU Mini v3.3):** ~1,035 tokens/request ≈ RM 0.00125.  
100 credits ≈ RM 0.13 API cost → **~99% margin** on RM 20.

### 4.3 Top-up packs (existing + aligned)

Use existing `TOPUP_BUNDLES` in `lib/settings/schemas.ts`:

| Bundle | Price | Credits |
|--------|------:|--------:|
| small | RM 10 | 50 |
| medium | RM 20 | 110 |
| large | RM 50 | 300 |

No new SKUs required for v1. Marketplace `boost-credits-300` remains optional one-time path.

---

## 5. Architecture

```
Owner → Marketplace → marketplace_activate_addon('hr-assistant')
                    → grant 100 credits + default agent settings

Owner → HR Assistant UI → POST /api/hr/assistant
                        → require addon active
                        → spend credits (or slow mode)
                        → openaiChat + tools
                        → ai_usage row

Cron 7am MYT → /api/cron/hr-daily-notice
             → tenants with addon + notice enabled
             → buildHrSnapshot → LLM or template
             → agent_daily_notices table
             → Home + HR overview widgets

Settings → AI Agents → GET/PATCH /api/settings/ai-agents/hr
                     → business_agent_settings
```

### 5.1 New database objects

**`business_agent_settings`**

```sql
business_id uuid FK
agent_slug text  -- 'hr'
display_name text not null default 'Hana'
assistant_enabled boolean default true
daily_notice_enabled boolean default true
daily_notice_hour smallint default 7  -- local hour MYT v1 fixed
created_at, updated_at
unique (business_id, agent_slug)
```

**`agent_daily_notices`**

```sql
id, business_id, agent_slug, notice_date date
title text, body text  -- markdown-lite plain text
source text default 'hr_snapshot'
created_at
unique (business_id, agent_slug, notice_date)
```

**`ai_usage`** (per call, append-only)

```sql
id, business_id, agent_slug, trigger_type, credits_charged,
mode text, tokens_in, tokens_out, cost_myr_estimated numeric,
metadata jsonb, created_at
```

**RPC `settings_spend_credits`**

- Atomic: check balance (or allow slow if `p_allow_slow`), insert negative `credit_ledger`, decrement `credit_balance`, return `{ charged, mode, new_balance }`

**RPC `settings_grant_credits`** (internal)

- Positive ledger without invoice (monthly grant, welcome)

### 5.2 Entitlement helper

`lib/marketplace/entitlements.ts`:

```typescript
hasActiveAddon(businessId, 'hr-assistant'): Promise<boolean>
loadAgentSettings(businessId, 'hr'): Promise<BusinessAgentSettings>
```

### 5.3 Chat history — Tier A only

- React state + `sessionStorage` key `hr-assistant-chat-v1`
- Max 20 messages stored client-side
- **New chat** button clears state + sessionStorage
- Lost on tab close / browser restart — intentional
- No server persistence

### 5.4 Agent personality

System prompt includes:

```
You are {display_name}, HR staff for {business_name}.
Respond in the user's language (BM or EN).
```

User can rename in Settings; chat header shows name + “HR Assistant”.

### 5.5 Daily notice

- Weekdays 7:00 AM `Asia/Kuala_Lumpur` (v1: Mon–Sat; skip Sunday optional)
- Template-first with optional 1-credit LLM polish (v1: **template only** for cost = 0)
- Surfaces:
  - `Home` — `AiBanner` or new `AgentNoticeCard` when HR notice exists
  - `/hr` overview — `HrInfoBanner` with today’s notice
- Toggle off → cron skips tenant

### 5.6 Tools (Phase F)

Add `update_leave_status` tool:

- Args: `employee_name`, `decision: approved|rejected`, optional `decision_note`
- Resolves pending leave for that employee (most recent pending)
- Reuses same DB update as `PATCH /api/hr/leave/[id]/status`

---

## 6. UX principles (non-IT)

| Pattern | Implementation |
|---------|----------------|
| Plain labels | “Ask Hana” not “Invoke LLM” |
| Suggested prompts | Large pill buttons (existing) |
| Credit meter | “⚡ 78 left this month” in chat header |
| Locked state | Friendly card: “Add HR Assistant in Marketplace — RM 20/month” |
| Slow mode | “Hana is thinking a bit longer…” amber text |
| New chat | Single obvious button, no tabs |
| Settings | Toggles with descriptions in BM-friendly English |

---

## 7. Security

- Addon + credits enforced server-side only
- `business_id` never from client body
- Tool actions validate tenant + `canManageHrCore`
- Cron uses `CRON_SECRET` + service role
- `ai_usage` RLS: tenant read-only
- No PII in `ai_usage.metadata` beyond leave_id / employee_id UUIDs

---

## 8. Testing strategy

- Unit: credit spend/grant RPCs, employee name match, leave approve tool
- API: assistant 403 without addon, 402/slow without credits
- Integration: activate addon → credits + settings row created
- Manual: Marketplace flow, chat, notice on home, rename agent

---

## 9. Rollout order

Phases A → F in one release branch; each phase shippable incrementally.

---

## 10. Open decisions (locked for v1)

| Question | Decision |
|----------|----------|
| Chat history | Tier A only |
| Daily notice LLM | Template-only v1 (0 credits) |
| Default agent name | Hana |
| Monthly credit rollover | No |
| Top-up rollover | Yes (existing policy) |
| HR addon slug | `hr-assistant` |
