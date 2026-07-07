-- Onboarding quiz answers + recommendation completion marker.

alter table public.businesses
  add column if not exists business_type text
    check (business_type is null or business_type in (
      'retail', 'fnb', 'services', 'online', 'freelancer', 'other'
    )),
  add column if not exists team_size_band text
    check (team_size_band is null or team_size_band in (
      'solo', '2-5', '6-15', '16+'
    )),
  add column if not exists onboarding_priorities jsonb,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.businesses.business_type is
  'Self-reported business type from onboarding quiz (analytics + bundle recommendation).';
comment on column public.businesses.team_size_band is
  'Self-reported team size band from onboarding quiz.';
comment on column public.businesses.onboarding_priorities is
  'Up to two priority areas selected during onboarding quiz.';
comment on column public.businesses.onboarding_completed_at is
  'When owner finished or skipped the post-sign-up recommendation page.';

-- Existing tenants skip the new onboarding gate.
update public.businesses
   set onboarding_completed_at = coalesce(created_at, now())
 where onboarding_completed_at is null;
