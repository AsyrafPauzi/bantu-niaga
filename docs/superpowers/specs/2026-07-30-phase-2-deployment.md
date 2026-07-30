# Phase 2 — Hybrid deployment (SaaS vs standalone)

> **Status:** Shipped 2026-07-30 (SMTP + Billplz production config deferred)  
> **Goal:** Same codebase deploys as multi-tenant SaaS **or** single-tenant on-prem install.

---

## What shipped

| Item | Implementation |
|------|----------------|
| `DEPLOYMENT_MODE` | `saas` (default) or `standalone` — server env + `NEXT_PUBLIC_DEPLOYMENT_MODE` for UI |
| Hide sign-up | Standalone redirects `/sign-up` → `/sign-in` after first business exists |
| Bootstrap once | Standalone allows **one** public sign-up while `businesses` count is 0 |
| Single company | `add-company` disabled; max 1 owned business per login in standalone |
| Health probe | `/api/health` returns `deploymentMode` |
| Optional pin | `STANDALONE_BUSINESS_ID` for scripts / data import targeting |

---

## Env vars

```bash
# SaaS (default — Vercel production)
DEPLOYMENT_MODE=saas
NEXT_PUBLIC_DEPLOYMENT_MODE=saas

# On-prem / single kedai install
DEPLOYMENT_MODE=standalone
NEXT_PUBLIC_DEPLOYMENT_MODE=standalone

# Optional — tenant UUID for seed/import scripts
# STANDALONE_BUSINESS_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Mirror server + public vars in Vercel so sign-in UI and API agree.

---

## Standalone bootstrap flow

1. Deploy with `DEPLOYMENT_MODE=standalone`.
2. **Option A:** Visit `/sign-up` once (allowed only when DB has zero businesses) → create owner.
3. **Option B:** `npm run seed` / `npm run seed:ai` with service role (recommended for demos).
4. Team members join via **invite** (`/accept-invite`), not public sign-up.
5. `/api/health` should report `"deploymentMode": "standalone"`.

---

## Explicitly deferred (Phase 2b)

- Custom domain + Supabase SMTP + Resend (`docs/DEPLOY-SMTP.md`)
- Billplz live keys + subscription renewals
- `marketplace_bundles` single-RPC checkout

---

## Key files

- `lib/platform/deployment.ts`
- `lib/platform/standalone-bootstrap.ts`
- `app/sign-up/layout.tsx` — bootstrap gate
- `app/api/auth/sign-up/route.ts` — API gate
- `app/api/auth/add-business/route.ts` — blocked in standalone

---

*Reference: [Phase 1 plan](./2026-07-30-phase-1-core-plan.md) §7*
