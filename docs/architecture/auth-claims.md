# Auth claims — `role` + `business_id` resolution

> How the app figures out *who you are* and *what tenant you belong to* on every request.

## v1: per-request DB lookup (current)

Every server-side check resolves `role` + `business_id` by joining `auth.uid()` against `public.users`:

- App layer: `getCurrentUser()` in `lib/auth/current-user.ts` selects `role, business_id from public.users where id = auth.uid()`.
- DB layer: `public.current_role()` and `public.current_business_id()` (both `security definer`, both defined in the Phase 0 migrations) do the same lookup inside RLS policies.

Pros:
- Trivial to reason about — one source of truth (`public.users`).
- Role/tenant changes take effect on the next request, no token rotation needed.
- No risk of stale claims hanging around in still-valid JWTs.

Cons:
- One extra `select` per request (sub-millisecond, indexed by primary key — fine to ~10K MAU).

This is what we ship in v1. Don't optimise it until profiling says we should.

## At scale: copy claims into the JWT (deferred)

When per-request lookups stop being free (rough watermark: P95 DB CPU consistently above 60% from `users` lookups, or sustained > 10K concurrent sessions), copy `role` and `business_id` into `app_metadata` via a Supabase **Custom Access Token Hook**.

Configure the hook in Supabase Studio under **Auth → Hooks → Custom Access Token**, or via the `supabase` CLI / Management API. The hook is a Postgres function the Supabase Auth gateway calls each time it mints a JWT.

```sql
-- DEFERRED — do not enable until v2 scale work.
--
-- Custom Access Token Hook: enriches the JWT with role + business_id
-- pulled from public.users. Supabase Auth will call this on every
-- access-token refresh.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_role text;
  user_business_id uuid;
begin
  claims := event->'claims';

  select role, business_id
    into user_role, user_business_id
    from public.users
    where id = (event->>'user_id')::uuid;

  if user_role is not null then
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      coalesce(claims->'app_metadata', '{}'::jsonb)
        || jsonb_build_object(
          'role', user_role,
          'business_id', user_business_id
        )
    );
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

-- grant usage to the supabase_auth_admin role; the hook is registered
-- in dashboard or via:
--   supabase functions deploy ... (or Management API call)
```

Once enabled, RLS policies can read claims directly via `auth.jwt() -> 'app_metadata' ->> 'role'` and skip the `public.users` lookup entirely.

## Why both options exist

| Aspect | Per-request lookup (v1) | JWT claim (deferred) |
|---|---|---|
| Latency per check | ~1 indexed PK select | ~0, claim already in JWT |
| Role-change recovery | Immediate (next request) | Delayed until token refresh (or forced sign-out) |
| Implementation cost | Already done | Hook + session rotation strategy + RLS rewrite |
| Failure mode | DB unavailable → request fails (correct) | Stale claim outlives a role revocation until refresh |

Per-request is the right default: simpler, safer for security, and fast enough at our v1 scale. Promote to JWT claims only when we have profiling evidence it matters and we've designed a session-rotation story (forced sign-out on role change, or short-lived access tokens with frequent refresh).
