# Tier → pillar entitlements

> Which plan unlocks which module. One matrix. Three enforcement
> layers. No ad-hoc tier checks anywhere else in the codebase.

## 1. The matrix

Defined once in [`lib/auth/entitlements.ts`](../../lib/auth/entitlements.ts):

```ts
export const TIER_PILLARS: Record<TierKey, readonly Pillar[]> = {
  starter:    ["finance"],
  micro:      ["finance", "admin", "operations"],
  sme:        ["finance", "admin", "operations", "sales", "hr"],
  enterprise: ["finance", "admin", "operations", "sales", "hr", "marketing"],
};
```

User-facing labels (display in the Subscription page + plan cards) live
in [`lib/settings/plans.ts`](../../lib/settings/plans.ts):

| `TierKey`   | Label  | Price       | Pillars                                                     |
|-------------|--------|-------------|-------------------------------------------------------------|
| `starter`   | Free   | RM 0/month  | Finance                                                     |
| `micro`     | Starter | RM 69/month | + Admin · Operations                                       |
| `sme`       | Growth  | RM 139/month| + Sales · HR                                               |
| `enterprise`| Pro     | RM 249/month| + Marketing                                                |

Subsequent tiers strictly include the previous tier's pillars — upgrades
never remove access.

## 2. Three enforcement layers

Each layer is independently sufficient. Together they make it
impossible to reach a pillar your tier doesn't include.

### Layer 1 — Server-side page guard (the contract)

[`lib/auth/require-pillar.ts`](../../lib/auth/require-pillar.ts) exports:

```ts
await requirePillar("operations");
// 1. resolves the current user via getCurrentUser()
// 2. selects businesses.tier
// 3. if !hasPillar(tier, pillar) → redirect(/settings/subscription?locked=operations)
```

It's called from each pillar's `layout.tsx`:

```
app/(app)/admin/layout.tsx       → requirePillar("admin")
app/(app)/operations/layout.tsx  → requirePillar("operations")
app/(app)/sales/layout.tsx       → requirePillar("sales")
app/(app)/hr/layout.tsx          → requirePillar("hr")
app/(app)/marketing/layout.tsx   → requirePillar("marketing")
```

Finance does not have a guard — every tier includes it.

**Rule:** every new pillar page inherits its parent layout's guard.
Never re-implement the tier check inside a page component.

### Layer 2 — UI affordances

The shell's sidebar
([`components/shells/desktop-shell.tsx`](../../components/shells/desktop-shell.tsx)),
the mobile bottom-nav
([`components/shells/mobile-shell.tsx`](../../components/shells/mobile-shell.tsx)),
the mobile More page ([`app/(app)/more/page.tsx`](../../app/(app)/more/page.tsx)),
and the Home pillar tiles
([`app/(app)/home/page.tsx`](../../app/(app)/home/page.tsx)) all:

1. Read the current `tier` (server-fetched once in
   [`app/(app)/layout.tsx`](../../app/(app)/layout.tsx) and passed via
   `<AdaptiveShell tier={...} />`).
2. Call `hasPillar(tier, pillar)`.
3. If locked, render a lock icon and rewrite the `href` to
   `/settings/subscription?locked=<pillar>` so a click takes the owner
   straight to the upgrade prompt instead of bouncing through the page
   guard.

### Layer 3 — Database (RLS still applies)

RLS continues to scope every query by `business_id` regardless of
tier. Even if Layers 1 + 2 were both bypassed, a starter tenant
fetching `/api/marketing/customers` would only see *their own*
(possibly empty) marketing rows — never another tenant's.

> Future work: a thin `requirePillarApi(req, pillar)` wrapper for the
> pillar-specific API routes so a 403 is returned before any DB hit.
> Not blocking for v1 because the UI cannot expose the routes to a
> non-entitled tier.

## 3. The upgrade prompt

`/settings/subscription?locked=<pillar>` is the canonical "you can't
reach that on your plan" landing page. The query param drives:

- A yellow banner at the top:
  *"Admin is not unlocked on your current plan. Switch to Starter
  (RM 69/month) or higher to access the Admin module."*
- The plan cards below give the owner a one-click switch.

The locked-pillar → minimum-tier mapping is in `SubscriptionView.tsx`:

```ts
const PILLAR_MIN_TIER: Record<string, TierKey> = {
  finance:    "starter",
  admin:      "micro",
  operations: "micro",
  sales:      "sme",
  hr:         "sme",
  marketing:  "enterprise",
};
```

This duplicates information already in `TIER_PILLARS`, but is kept
inline because the banner copy needs to know the *minimum* tier (not
just any unlocking tier).

## 4. Database invariant

[`supabase/migrations/00000000000013_tier_enterprise.sql`](../../supabase/migrations/00000000000013_tier_enterprise.sql)
constrains `businesses.tier` to:

```sql
check (tier in ('starter', 'micro', 'sme', 'enterprise'))
```

…and the `settings_change_tier` RPC validates the same set. There is no
"trial" or "custom" tier — paying customers pick from the four.

`subscription_status` (separate column) carries the lifecycle state:
`trial | active | past_due | cancelled`. Trial businesses are still on
some tier; the status only gates billing flows.

## 5. Adding a new pillar (checklist)

1. Add the pillar to `lib/auth/entitlements.ts`:
   - Append to `PILLARS`, `PILLAR_LABEL`, and the per-tier rows of
     `TIER_PILLARS`.
2. Create `app/(app)/<pillar>/layout.tsx`:
   ```tsx
   import { requirePillar } from "@/lib/auth/require-pillar";
   export default async function Layout({ children }) {
     await requirePillar("<pillar>");
     return <>{children}</>;
   }
   ```
3. Add a sidebar item with `pillar: "<pillar>"` to
   `components/shells/desktop-shell.tsx` and the mobile equivalents as
   relevant.
4. Add a tile to the home page's `PILLAR_OVERVIEW` array.
5. Add the upgrade label to `PILLAR_MIN_TIER` in
   `components/settings/SubscriptionView.tsx`.

If any of these are missed:

- Missing layout guard → the page is reachable on the wrong tier.
- Missing sidebar `pillar` key → the menu item appears for everyone.
- Missing home tile → users won't see they're missing a module.
- Missing `PILLAR_MIN_TIER` entry → upgrade banner falls back to
  "enterprise".

## 6. Why not Middleware?

We considered enforcing tier in `middleware.ts` so the redirect happens
at the edge. Two reasons we don't:

1. **One DB lookup per request.** Middleware already calls
   `auth.getUser()`. Adding `select tier from businesses` would either
   double the lookup or require duplicating the user → business join in
   middleware.
2. **The page guard is the right granularity.** When pillar APIs grow
   their own tier checks (`requirePillarApi`), they'll live alongside
   the page guard. Middleware is one layer too coarse to host both.

The page guard runs in the same RSC pass that loads page data, so it's
effectively free.
