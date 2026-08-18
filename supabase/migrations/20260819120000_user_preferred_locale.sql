-- NiagaX — email / UI language preference (en | ms)
alter table public.users
  add column if not exists preferred_locale text not null default 'en';

alter table public.users
  drop constraint if exists users_preferred_locale_check;

alter table public.users
  add constraint users_preferred_locale_check
  check (preferred_locale in ('en', 'ms'));

comment on column public.users.preferred_locale is
  'Email and Appearance language: en (default) or ms.';
