# Super Admin (Platform Admin)

> A second app at `/super-admin/*` that lets Bantu Niaga staff monitor and
> operate the platform: users, tenants, plans, marketplace, AI agents, and
> the data-monitor pitch surface. Lives alongside the tenant app, never
> inside it.

## 1. Mental model

Two distinct call surfaces share one Next.js codebase:

```
app/
  (app)/        ← tenant-scoped: every page resolves a `business_id`
  (super-admin)/← cross-tenant: every page resolves a `platform_admin`
```

Membership is **separate** from any tenant. A platform admin who is also
an owner of a tenant has two separate identities surfaced by two distinct
guards (`requirePillar`/`getCurrentUser` for the tenant app and
`requirePlatformAdmin()` for the super-admin app).

Why the split:

- **Blast radius.** Tenant routes operate inside RLS. Super-admin routes
  use the service-role client and explicitly span tenants. Mixing them
  would let a tenant RLS bug accidentally exfiltrate cross-tenant data.
- **UI distinction.** The super-admin shell is dark-themed and visually
  unambiguous — staff always know they're "above the line".
- **Audit story.** Every super-admin mutation lands in
  `super_admin_audit` so we can prove (to investors, regulators, and
  customers) who did what to whom.

## 2. Database (migration 15)

[`supabase/migrations/00000000000015_super_admin.sql`](../../supabase/migrations/00000000000015_super_admin.sql) introduces:

| Table | Purpose |
|---|---|
| `platform_admins` | Allow-list of staff. Membership grants cross-tenant read + the ability to call `super_admin_*` RPCs. |
| `ai_agents` | Catalog of AI copilots (Maya, Operations AI, …). One row per agent. |
| `ai_agent_versions` | Versioned scope + guardrails JSON. `ai_agents.published_version_id` points at the row the runtime currently uses. |
| `ai_agent_usage_daily` | Per-tenant daily roll-up of agent invocations, latency, failures, and spend. |
| `super_admin_audit` | Cross-tenant audit — distinct from per-tenant `audit_log`. |

Helper:

```sql
public.is_platform_admin() returns boolean;
```

Used by RLS policies on `businesses`, `users`, `invoices`,
`credit_ledger`, `business_addons`, `audit_log`, `ai_agents`,
`ai_agent_versions`, and `ai_agent_usage_daily` to let platform admins
read across tenants.

### RPCs (all `security definer`, all check `is_platform_admin()`):

| RPC | What it does |
|---|---|
| `super_admin_grant_admin(email, user_id?, display_name?, notes?)` | Adds a new platform admin. |
| `super_admin_set_business_status(business_id, status, reason?)` | Suspend/restore a tenant. |
| `super_admin_set_user_role(user_id, role)` | Force-set a user's role (e.g. demote owner before deletion). |
| `super_admin_save_agent_version(agent_slug, version_label, system_prompt, allowed_actions, guardrails, escalation, knowledge_base, default_tone?, publish?)` | Save (and optionally publish) a new AI agent scope version. |
| `super_admin_set_marketplace_status(addon_slug, status)` | Flip `live` ↔ `draft` ↔ `disabled` on a marketplace add-on. |

### Bootstrap

The migration ends by seeding `asyraf@bantuniaga.demo` as the founding
platform admin. The seed is idempotent — re-running migration 15 won't
duplicate the row. Add more admins via `super_admin_grant_admin`.

## 3. Code layout

```
app/(super-admin)/super-admin/
  layout.tsx               ← calls requirePlatformAdmin(), wraps in SuperAdminShell
  page.tsx                 ← Overview
  users/page.tsx
  businesses/page.tsx
  plans/page.tsx
  marketplace/page.tsx
  ai-agents/page.tsx
  ai-agents/[slug]/page.tsx
  data-monitor/page.tsx
  investor-metrics/page.tsx
  audit/page.tsx

app/api/super-admin/
  impersonate/route.ts             ← POST/DELETE
  users/[id]/route.ts              ← PATCH (suspend/restore/set_role/reset_password) + DELETE
  users/invite/route.ts            ← POST
  businesses/[id]/route.ts         ← PATCH (set_status/set_tier)
  marketplace/[id]/route.ts        ← PATCH (status toggle)
  agents/[slug]/route.ts           ← PUT (save scope version)

components/super-admin/
  SuperAdminShell.tsx              ← dark sidebar
  PageTopbar.tsx, primitives.tsx
  UserRowActions.tsx               ← impersonate + row menu (client)
  MarketplaceToggle.tsx            ← live/disabled switch (client)
  AgentScopeEditor.tsx             ← scope + guardrails editor (client)
  Sparkline.tsx
  ImpersonationBanner.tsx          ← rendered into (app) layout when impersonating

lib/super-admin/
  load.ts                          ← all server-side loaders (service-role)
  types.ts                         ← shared DTOs

lib/auth/
  require-platform-admin.ts        ← guard
  impersonation.ts                 ← cookie primitives
  current-user.ts                  ← reads impersonation cookie when present
```

## 4. Auth + middleware

`middleware.ts` now matches `"/super-admin/:path*"` so Supabase session
refresh happens for super-admin routes as well.

`app/(super-admin)/super-admin/layout.tsx` calls
`requirePlatformAdmin()`, which:

1. Reads the Supabase session. No session → redirect to `/sign-in`.
2. Looks up `platform_admins` by `user_id`. Missing or revoked →
   redirect to `/home?reason=not_platform_admin`.
3. Returns the platform admin's identity, which is passed into
   `<SuperAdminShell admin={…} />`.

## 5. Impersonation

When a platform admin clicks **Impersonate** in the users table:

1. `POST /api/super-admin/impersonate` with `{ targetUserId }`.
2. The route re-checks the guard, resolves the target via service-role,
   writes an `user.impersonate_start` audit row, and sets the
   `bn_impersonate` cookie with a 1h TTL.
3. The browser navigates to `/home`. The tenant app's `getCurrentUser()`
   sees the cookie, fetches the *target* user via service-role, and
   returns the target's `role` + `businessId`. Every read in the tenant
   app then behaves as the target user would.
4. The `(app)/layout.tsx` renders `<ImpersonationBanner />` (a server
   component) which produces a sticky yellow banner with admin
   identity, target identity, TTL, and a **Stop impersonating** button.
5. Clicking **Stop** calls `DELETE /api/super-admin/impersonate`, which
   clears the cookie and audits the stop.

`IMPERSONATION_ALLOWS_WRITES` defaults to `false`. Mutations performed
during impersonation are gated by this flag — flip it to `true` only
when you specifically want to drive a customer-side write from staff,
and remember that every mutation is still audited.

## 6. AI agent scope (railguards)

Every agent has:

- One row in `ai_agents` (slug, name, pillar, icon, default model,
  status, published_version_id).
- N rows in `ai_agent_versions`, each a versioned JSON bundle of
  `{ system_prompt, allowed_actions, guardrails, escalation,
  knowledge_base, default_tone }`.

The runtime (Maya / Operations AI / Finance AI / Boardroom / HR Helper /
Concierge) loads the **published** version at conversation start and:

- Refuses any tool call not present in `allowed_actions` where `on=true`.
- Folds `guardrails` into the system prompt as hard rules.
- Triggers `escalation` rules when the matching condition fires (low
  confidence, complaint detection, repeated failures, …).
- Pulls context only from `knowledge_base` entries.

`app/(super-admin)/super-admin/ai-agents/[slug]/page.tsx` hosts the
editor (`AgentScopeEditor`). Saving calls `PUT
/api/super-admin/agents/[slug]` → `super_admin_save_agent_version`,
which inserts a new version row and (when `publish=true`) flips
`ai_agents.published_version_id` to point at it. Roll-out is therefore
near-instant: existing conversations continue on their loaded scope,
new conversations pick up the new version.

## 7. Data monitor (investor pitch surface)

`app/(super-admin)/super-admin/data-monitor/page.tsx` shows
platform-wide volume — invoices, POS sales, customer profiles, AI
invocations, credit-ledger entries, add-on subscriptions — plus a
stacked monthly chart. A separate `investor-metrics` page derives MRR,
ARR projection, ARPU, paying-tenant count, and plan mix.

Numbers come from real tables (no fake demos):

```
loadDataMonitor() →
  count(invoices)
  count(audit_log where entity_type like 'customer%')
  count(business_addons)
  count(credit_ledger)
  sum(ai_agent_usage_daily.invocations)
  count(events_outbox)
  + invoices grouped by business → top contributors
```

The monthly chart's per-month split is currently synthesised because we
don't yet aggregate counts in time buckets; once we add a small
`platform_daily_metrics` roll-up table the chart switches to real data
with no UI changes.

## 8. Adding a new platform admin

In SQL:

```sql
select public.super_admin_grant_admin(
  p_email        => 'newadmin@bantuniaga.com',
  p_display_name => 'New Admin'
);
```

The function will pick up the matching `auth.users.id` if they've
already signed up, otherwise the row is created without a `user_id` and
gets linked on first sign-in. Every grant lands in `super_admin_audit`.

## 9. Removing a platform admin

```sql
update public.platform_admins
   set revoked_at = now()
 where email = 'oldadmin@bantuniaga.com';
```

`is_platform_admin()` ignores rows with `revoked_at`, so this takes
effect on the admin's next request.
