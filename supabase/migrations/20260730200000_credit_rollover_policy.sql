-- Credit rollover policy: top-ups roll over; monthly AI bundle credits reset on renewal.

alter table public.businesses
  add column if not exists credit_topup_balance integer not null default 0;

comment on column public.businesses.credit_topup_balance is
  'Fast Credits purchased via top-up. Rolls over indefinitely. Remainder of credit_balance is monthly bundle (resets on AI addon renewal).';

-- Backfill: top-up portion capped at current balance.
update public.businesses b
   set credit_topup_balance = least(
     b.credit_balance,
     coalesce(
       (
         select sum(cl.delta)
           from public.credit_ledger cl
          where cl.business_id = b.id
            and cl.reason = 'topup'
            and cl.delta > 0
       ),
       0
     )
   )
 where credit_topup_balance = 0;

-- Grant credits: monthly bundle grants expire up to grant size before re-adding.
create or replace function public.settings_grant_credits(
  p_business_id uuid,
  p_credits integer,
  p_reason text,
  p_actor_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance integer;
  v_topup integer;
  v_bundle integer;
  v_new_bundle integer;
  v_new_balance integer;
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  select credit_balance, coalesce(credit_topup_balance, 0)
    into v_balance, v_topup
    from public.businesses
   where id = p_business_id
   for update;

  if not found then
    raise exception 'business not found';
  end if;

  if position('monthly_grant' in p_reason) > 0 then
    v_bundle := greatest(0, v_balance - v_topup);
    v_new_bundle := greatest(0, v_bundle - p_credits) + p_credits;
    v_new_balance := v_topup + v_new_bundle;
  else
    v_new_balance := v_balance + p_credits;
  end if;

  insert into public.credit_ledger (business_id, delta, reason, actor_user_id)
  values (p_business_id, p_credits, p_reason, p_actor_user_id);

  update public.businesses
     set credit_balance = v_new_balance,
         credit_topup_balance = v_topup
   where id = p_business_id
   returning credit_balance into v_new_balance;

  return v_new_balance;
end;
$$;

-- Spend bundle credits first; top-up credits roll over and spend last.
create or replace function public.settings_spend_credits(
  p_business_id uuid,
  p_credits integer,
  p_reason text,
  p_actor_user_id uuid default null,
  p_allow_slow boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance integer;
  v_topup integer;
  v_bundle integer;
  v_from_topup integer;
  v_charged integer := 0;
  v_mode text := 'fast';
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  select credit_balance, coalesce(credit_topup_balance, 0)
    into v_balance, v_topup
    from public.businesses
   where id = p_business_id
   for update;

  if not found then
    raise exception 'business not found';
  end if;

  if v_balance >= p_credits then
    v_charged := p_credits;
    v_mode := 'fast';
    v_bundle := greatest(0, v_balance - v_topup);
    v_from_topup := greatest(0, p_credits - v_bundle);

    insert into public.credit_ledger (business_id, delta, reason, actor_user_id)
    values (p_business_id, -p_credits, p_reason, p_actor_user_id);

    update public.businesses
       set credit_balance = credit_balance - p_credits,
           credit_topup_balance = credit_topup_balance - v_from_topup
     where id = p_business_id
     returning credit_balance into v_balance;
  elsif p_allow_slow then
    v_charged := 0;
    v_mode := 'slow';
  else
    raise exception 'insufficient_credits';
  end if;

  return jsonb_build_object(
    'charged', v_charged,
    'mode', v_mode,
    'new_balance', v_balance
  );
end;
$$;

create or replace function public.settings_topup_credits(
  p_business_id uuid,
  p_credits integer,
  p_amount_myr numeric,
  p_payment_method_id uuid,
  p_user_id uuid
)
returns table (
  invoice_id uuid,
  new_balance integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice_id uuid;
  v_number text;
  v_balance integer;
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  v_number := 'TU-' || to_char(now(), 'YYYYMMDD') || '-' ||
              substring(uuid_generate_v4()::text from 1 for 6);

  insert into public.invoices (
    business_id, number, kind, period_label,
    amount_myr, tax_myr, status, payment_method_id, paid_at
  )
  values (
    p_business_id, v_number, 'topup', 'Fast Credits top-up',
    p_amount_myr, 0, 'paid', p_payment_method_id, now()
  )
  returning id into v_invoice_id;

  insert into public.credit_ledger (
    business_id, delta, reason, invoice_id, actor_user_id
  )
  values (p_business_id, p_credits, 'topup', v_invoice_id, p_user_id);

  update public.businesses
     set credit_balance = credit_balance + p_credits,
         credit_topup_balance = coalesce(credit_topup_balance, 0) + p_credits
   where id = p_business_id
   returning credit_balance into v_balance;

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    p_business_id, p_user_id, 'billing.topup', 'invoice', v_invoice_id,
    jsonb_build_object('credits', p_credits, 'amount_myr', p_amount_myr)
  );

  return query select v_invoice_id, v_balance;
end;
$$;

create or replace function public.settings_complete_topup_billplz(
  p_billplz_id text
)
returns table (business_id uuid, new_balance integer)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_intent public.billplz_payment_intents%rowtype;
  v_balance integer;
  v_user_id uuid;
begin
  select * into v_intent
    from public.billplz_payment_intents
   where billplz_id = p_billplz_id
   for update;

  if not found then
    raise exception 'intent not found';
  end if;

  if v_intent.status = 'paid' then
    select credit_balance into v_balance
      from public.businesses where id = v_intent.business_id;
    return query select v_intent.business_id, v_balance;
    return;
  end if;

  v_user_id := (v_intent.meta->>'user_id')::uuid;

  update public.invoices
     set status = 'paid', paid_at = now()
   where id = v_intent.invoice_id;

  insert into public.credit_ledger (
    business_id, delta, reason, invoice_id, actor_user_id
  )
  values (
    v_intent.business_id, v_intent.credits, 'topup',
    v_intent.invoice_id, v_user_id
  );

  update public.businesses
     set credit_balance = credit_balance + v_intent.credits,
         credit_topup_balance = coalesce(credit_topup_balance, 0) + v_intent.credits
   where id = v_intent.business_id
   returning credit_balance into v_balance;

  update public.billplz_payment_intents
     set status = 'paid', paid_at = now()
   where id = v_intent.id;

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    v_intent.business_id, v_user_id, 'billing.topup', 'invoice', v_intent.invoice_id,
    jsonb_build_object(
      'credits', v_intent.credits,
      'amount_myr', v_intent.amount_myr,
      'billplz_id', p_billplz_id
    )
  );

  return query select v_intent.business_id, v_balance;
end;
$$;
