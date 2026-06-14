# PDPA compliance

Bantu Niaga aligns with **Malaysia's Personal Data Protection Act 2010**
(and its 2024 amendments). This doc maps each PDPA principle to the
concrete pieces of code that satisfy it.

## TL;DR

| PDPA right                  | Where it lives                                 |
| --------------------------- | ---------------------------------------------- |
| Right to access (s.30)      | `POST /api/privacy/export` → JSON bundle       |
| Right to data portability   | Same endpoint — machine-readable JSON         |
| Right to rectification      | `/settings/business`, `/settings/security`, …  |
| Right to erasure            | `POST /api/privacy/delete` (30-day grace)      |
| Right to withdraw consent   | `POST /api/privacy/consents`                   |
| Right to object             | `dpo@bantuniaga.com` + DSR log                 |
| Privacy notice (s.7)        | `/legal/privacy`                               |
| DSR audit trail             | `public.data_subject_requests`                 |

## Database schema

`supabase/migrations/00000000000017_pdpa.sql`.

### `data_subject_requests`

One row per DSR (export, delete, consent_change, rectify, object). Lifecycle:

```
pending → in_progress → completed
                     ↘ failed
            ↘ awaiting_grace (only delete_*) → completed | cancelled
```

Statuses are intentionally enum-checked at the DB level. The `scheduled_for`
column carries the hard-delete due date during `awaiting_grace`.

RLS:

- Users can `SELECT` only their own rows.
- Users can `INSERT` only `user_id = auth.uid()`.
- Users can `UPDATE` only their own `pending`/`awaiting_grace` rows.
- Platform admins (`is_platform_admin()`) see and mutate everything.

### `user_consents`

One row per `(user_id, kind)` with the latest grant state. Withdrawals
flip `granted` to `false` and stamp `withdrawn_at`. The full change history
is in `audit_log` under `action='privacy.consents.updated'`.

The catalog of consent kinds is **closed** — adding a new one requires a
migration. This is intentional: every consent has explicit copy in
`lib/privacy/catalog.ts` so we can prove what the user actually saw.

### `users.deletion_*` and `businesses.deletion_*`

Soft-delete columns that the UI checks to banner the user during the grace
window. The hard-delete sweep (`privacy_execute_pending_deletions()`)
clears PII columns and sets `deleted_at`.

### `data_exports`

Short-lived cache of generated bundles (7-day expiry). Storing them as
JSONB lets the user re-download until expiry and gives the support team a
chain-of-custody for the export.

## Account deletion flow

1. User opens **Settings → Privacy & data** and clicks **Schedule deletion**.
2. UI requires typing `DELETE` to gate the destructive action.
3. `POST /api/privacy/delete` inserts a DSR with `status='awaiting_grace'`
   and `scheduled_for = now() + 30 days`. The user's `deletion_*` columns
   are stamped so the warning banner shows everywhere.
4. The user can cancel any time before `scheduled_for` via
   `DELETE /api/privacy/delete` (the UI provides a one-click Cancel button).
5. Every hour, `/api/cron/privacy-sweep` calls
   `privacy_execute_pending_deletions()` which:
   - flips `status` to `in_progress` then `completed`,
   - nulls out the principal's PII columns (or cascades for
     `delete_business`), and
   - returns the rows so the worker can also delete the corresponding
     `auth.users` records via the service-role client.

### Why a grace period at all?

Three reasons:

- **PDPA s.30(2)**: the Commissioner expects a reasonable processing time.
- **Account-takeover defence**: stops an attacker from instantly nuking the
  account if they briefly gain access — the real owner gets 30 days to
  notice and cancel.
- **Audit / dispute resolution**: the audit log row pointing at the deletion
  request stays in place even after the user's row is gone.

## Data export bundle

`lib/privacy/load.ts` → `buildExportBundle()`.

The bundle pulls (per tenant, scoped to the user):

- `users` profile row
- `businesses` row (basic columns; PII you authored vs. owned distinction)
- `user_consents` history
- `data_subject_requests` you have filed
- `audit_log` rows where you are `actor_user_id`
- `social_accounts` you connected
- `content_plan` rows you created
- `customers` rows you created

Cap of 5000 rows per array — anything beyond that should be paginated.
Format is JSON so it's portable and human-readable.

## Cookie policy

We use only strictly-necessary cookies (session, CSRF, consent state).
No tracking / advertising cookies, so no cookie banner is required under
the PDPA. If we ever add analytics cookies, this changes — see
`docs/architecture/social-integrations.md` for the playbook.

## Operating the cron

1. Set `CRON_SECRET` in your Vercel project's env (32-byte hex string).
2. Vercel Cron is configured by `vercel.json` to call `/api/cron/privacy-sweep`
   hourly. It auto-attaches the bearer token.
3. To test locally:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
        http://localhost:3000/api/cron/privacy-sweep
   ```

## Adding a new consent

1. Add the kind to the `check (kind in (...))` constraint in a new migration.
2. Append a `ConsentDescriptor` to `CONSENT_CATALOG` in
   `lib/privacy/catalog.ts`.
3. Bump `PRIVACY_POLICY_VERSION` env var so existing users are prompted to
   re-consent (UI banner — TODO).
4. Update `app/legal/privacy/page.tsx` with the new description.

## What's intentionally NOT here

- **Real signed-URL exports for very large tenants.** The JSONB column
  works for <5MB bundles. For larger, swap in Supabase Storage signed
  URLs in `buildExportBundle()`.
- **Granular per-table deletion.** A user can either close their account
  or stay. There's no "delete only my marketing data". If you need that,
  build a more granular DSR kind.
- **Cookie banner.** Not required for our cookie set (strictly necessary
  only). Add one if you ship analytics cookies.
