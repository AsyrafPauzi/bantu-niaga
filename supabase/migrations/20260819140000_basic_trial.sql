-- 7-day Basic self-serve trial. Do not rewrite existing trial renewal timestamps.

alter table public.businesses
  add column if not exists self_serve_trial_used_at timestamptz;

comment on column public.businesses.self_serve_trial_used_at is
  'When this business started a self-serve trial. Null = toolbar eligible (Free only).';

update public.businesses
   set self_serve_trial_used_at = coalesce(self_serve_trial_used_at, now())
 where subscription_status = 'trial'
   and self_serve_trial_used_at is null;

update public.businesses b
   set self_serve_trial_used_at = coalesce(b.self_serve_trial_used_at, a.created_at)
  from public.audit_log a
 where a.entity_id = b.id
   and a.action = 'auth.sign_up'
   and (
     a.diff->>'signup_path' = 'starter_trial'
     or coalesce((a.diff->>'trial_days')::int, 0) > 0
   )
   and b.self_serve_trial_used_at is null;

create or replace function public.subscription_process_renewals()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_count integer := 0;
  v_label text;
  v_next interval;
  v_credits integer;
begin
  for v_row in
    select id, tier, subscription_status, subscription_renewal_at,
           credit_balance, credit_topup_balance
      from public.businesses
     where subscription_renewal_at is not null
       and subscription_renewal_at <= now()
       and subscription_status in ('active', 'trial')
  loop
    if v_row.subscription_status = 'trial' then
      v_label := 'Trial ended';
      perform public.settings_issue_subscription_invoice(
        v_row.id,
        null,
        v_label,
        0
      );
      update public.businesses
         set tier = 'starter',
             subscription_status = 'active',
             subscription_renewal_at = now() + interval '30 days',
             credit_balance = coalesce(credit_topup_balance, 0)
       where id = v_row.id;
    else
      v_label := to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY') ||
        case when v_row.tier = 'starter' then ' — Free plan' else '' end;

      perform public.settings_issue_subscription_invoice(
        v_row.id,
        null,
        v_label,
        public.subscription_tier_amount_myr(v_row.tier)
      );

      v_credits := public.subscription_tier_bundled_credits(v_row.tier);
      if v_credits > 0 then
        perform public.settings_grant_credits(
          v_row.id,
          v_credits,
          'subscription_monthly_grant',
          null
        );
      end if;

      v_next := interval '30 days';
      update public.businesses
         set subscription_renewal_at = now() + v_next
       where id = v_row.id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.settings_start_basic_trial(
  p_business_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tier text;
  v_status text;
  v_used timestamptz;
  v_updated integer;
begin
  select tier, subscription_status, self_serve_trial_used_at
    into v_tier, v_status, v_used
    from public.businesses
   where id = p_business_id
   for update;

  if not found then
    raise exception 'invalid_status';
  end if;

  if v_used is not null then
    raise exception 'trial_already_used';
  end if;

  if v_tier is distinct from 'starter' or v_status is distinct from 'active' then
    raise exception 'invalid_status';
  end if;

  update public.businesses
     set tier = 'basic',
         subscription_status = 'trial',
         subscription_renewal_at = now() + interval '7 days',
         self_serve_trial_used_at = now()
   where id = p_business_id
     and tier = 'starter'
     and subscription_status = 'active'
     and self_serve_trial_used_at is null;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'trial_already_used';
  end if;

  perform public.settings_grant_credits(
    p_business_id,
    20,
    'basic_trial_grant',
    p_user_id
  );

  perform public.settings_issue_subscription_invoice(
    p_business_id,
    p_user_id,
    '7-day Basic trial',
    0
  );

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    p_business_id,
    p_user_id,
    'subscription.basic_trial_start',
    'business',
    p_business_id,
    jsonb_build_object('credits_granted', 20, 'trial_days', 7)
  );
end;
$$;

revoke all on function public.settings_start_basic_trial(uuid, uuid) from public;
grant execute on function public.settings_start_basic_trial(uuid, uuid) to authenticated;
