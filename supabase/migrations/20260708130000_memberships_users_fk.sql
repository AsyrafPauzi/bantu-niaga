-- PostgREST can only auto-join public schema tables. Point memberships.user_id
-- at public.users (same uuid as auth.users) instead of auth.users directly.

alter table public.user_business_memberships
  drop constraint if exists user_business_memberships_user_id_fkey;

alter table public.user_business_memberships
  add constraint user_business_memberships_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;
