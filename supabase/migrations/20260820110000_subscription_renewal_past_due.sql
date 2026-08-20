-- Renewal: pending subscription invoices for paid tiers; mark past_due after grace.
-- Grace = 7 days after subscription_renewal_at (spec).

create or replace function public.settings_issue_subscription_invoice_pending(
  p_business_id uuid,
  p_user_id uuid default null,
  p_period_label text default null,
  p_amount_myr numeric default null,
  p_tier text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tier text;
  v_amount numeric(10, 2);
  v_label text;
  v_number text;
  v_invoice_id uuid;
begin
  select coalesce(p_tier, tier) into v_tier
    from public.businesses
   where id = p_business_id;

  if v_tier is null then
    raise exception 'business not found';
  end if;

  v_amount := coalesce(p_amount_myr, public.subscription_tier_amount_myr(v_tier));
  if v_amount <= 0 then
    raise exception 'pending invoice requires positive amount';
  end if;

  v_label := coalesce(
    p_period_label,
    to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY') || ' — renewal'
  );

  v_number := 'SUB-' || to_char(now(), 'YYYYMMDD') || '-' ||
              substring(extensions.uuid_generate_v4()::text from 1 for 6);

  insert into public.invoices (
    business_id, number, kind, period_label,
    amount_myr, tax_myr, status, paid_at
  )
  values (
    p_business_id,
    v_number,
    'subscription',
    v_label,
    v_amount,
    0,
    'pending',
    null
  )
  returning id into v_invoice_id;

  if p_user_id is not null then
    insert into public.audit_log (
      business_id, actor_user_id, action, entity_type, entity_id, diff
    )
    values (
      p_business_id,
      p_user_id,
      'billing.subscription_invoice_pending',
      'invoice',
      v_invoice_id,
      jsonb_build_object(
        'period_label', v_label,
        'amount_myr', v_amount,
        'tier', v_tier
      )
    );
  end if;

  return v_invoice_id;
end;
$$;

revoke all on function public.settings_issue_subscription_invoice_pending(
  uuid, uuid, text, numeric, text
) from public;
grant execute on function public.settings_issue_subscription_invoice_pending(
  uuid, uuid, text, numeric, text
) to service_role;

-- Renewals: Free still RM0 paid invoice; trial expiry; paid → pending invoice only.
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
  v_credits integer;
  v_pending_exists boolean;
begin
  for v_row in
    select id, tier, subscription_status, subscription_renewal_at
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
      v_count := v_count + 1;
    elsif v_row.tier = 'starter' then
      v_label := to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY')
        || ' — Free plan';
      perform public.settings_issue_subscription_invoice(
        v_row.id,
        null,
        v_label,
        0
      );
      update public.businesses
         set subscription_renewal_at = now() + interval '30 days'
       where id = v_row.id;
      v_count := v_count + 1;
    else
      -- Paid active: do not auto-extend. Ensure a pending renewal invoice exists.
      select exists (
        select 1
          from public.invoices i
         where i.business_id = v_row.id
           and i.kind = 'subscription'
           and i.status = 'pending'
           and i.amount_myr > 0
      ) into v_pending_exists;

      if not v_pending_exists then
        v_label := to_char(timezone('Asia/Kuala_Lumpur', now()), 'Mon YYYY')
          || ' — renewal';
        perform public.settings_issue_subscription_invoice_pending(
          v_row.id,
          null,
          v_label,
          public.subscription_tier_amount_myr(v_row.tier),
          v_row.tier
        );
      end if;
      -- Leave subscription_renewal_at and status unchanged until paid or past_due.
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Mark past_due when renewal overdue by 7+ days and unpaid pending invoice exists.
create or replace function public.subscription_mark_past_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.businesses b
     set subscription_status = 'past_due'
   where b.subscription_status = 'active'
     and b.tier is distinct from 'starter'
     and b.subscription_renewal_at is not null
     and b.subscription_renewal_at + interval '7 days' < now()
     and exists (
       select 1
         from public.invoices i
        where i.business_id = b.id
          and i.kind = 'subscription'
          and i.status = 'pending'
          and i.amount_myr > 0
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.subscription_mark_past_due() from public;
grant execute on function public.subscription_mark_past_due() to service_role;

-- When paying a renewal (same tier), extend renewal date without requiring pending_tier change.
-- Extend settings_complete_subscription_billplz: if pending_tier equals current tier OR
-- meta has renewal=true, treat as renewal (extend + credits) via apply with same tier.
-- Upgrade path already sets pending_tier to new tier.

-- Also: attach Billplz to existing pending renewal invoices from cron (TS side).
-- Extend complete to restore past_due → active (settings_apply_paid_tier already sets active).

-- Renewal checkout: allow creating intent for an existing pending invoice.
create or replace function public.settings_attach_subscription_billplz(
  p_invoice_id uuid,
  p_billplz_id text,
  p_billplz_url text,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_tier text;
  v_intent_id uuid;
begin
  select * into v_inv
    from public.invoices
   where id = p_invoice_id
   for update;

  if not found then
    raise exception 'invoice not found';
  end if;

  if v_inv.kind is distinct from 'subscription' or v_inv.status is distinct from 'pending' then
    raise exception 'invoice not pending subscription';
  end if;

  select tier into v_tier from public.businesses where id = v_inv.business_id;

  if v_tier is null or v_tier = 'starter' then
    raise exception 'invalid tier for renewal';
  end if;

  -- Idempotent: return existing pending intent for this bill if any
  select id into v_intent_id
    from public.billplz_payment_intents
   where billplz_id = p_billplz_id
   limit 1;

  if v_intent_id is not null then
    return v_intent_id;
  end if;

  insert into public.billplz_payment_intents (
    business_id, invoice_id, billplz_id, billplz_url,
    kind, credits, amount_myr, status, meta
  )
  values (
    v_inv.business_id, v_inv.id, p_billplz_id, p_billplz_url,
    'subscription', null, v_inv.amount_myr, 'pending',
    jsonb_build_object(
      'user_id', p_user_id,
      'pending_tier', v_tier,
      'renewal', true
    )
  )
  returning id into v_intent_id;

  return v_intent_id;
end;
$$;

revoke all on function public.settings_attach_subscription_billplz(uuid, text, text, uuid)
  from public;
grant execute on function public.settings_attach_subscription_billplz(uuid, text, text, uuid)
  to service_role;
