-- Phase 2 platform polish: Billplz pending payments, finance quotes, invoice DuitNow flag.

-- ── Billplz payment intents (top-up + future subscription charges) ─────────
create table if not exists public.billplz_payment_intents (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  invoice_id      uuid not null references public.invoices (id) on delete cascade,
  billplz_id      text not null,
  billplz_url     text not null,
  kind            text not null default 'topup'
                  check (kind in ('topup', 'subscription', 'addon')),
  credits         integer,
  amount_myr      numeric(10, 2) not null check (amount_myr >= 0),
  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'failed')),
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz
);

create unique index if not exists billplz_payment_intents_billplz_id_idx
  on public.billplz_payment_intents (billplz_id);

create index if not exists billplz_payment_intents_business_idx
  on public.billplz_payment_intents (business_id, status, created_at desc);

alter table public.billplz_payment_intents enable row level security;

drop policy if exists "billplz_intents_select" on public.billplz_payment_intents;
create policy "billplz_intents_select" on public.billplz_payment_intents
  for select using (business_id = public.current_business_id());

-- Inserts/updates via service role + security definer RPCs only.

-- Pending top-up invoice (Billplz checkout — credits applied on webhook).
create or replace function public.settings_create_topup_pending(
  p_business_id uuid,
  p_credits integer,
  p_amount_myr numeric,
  p_payment_method_id uuid,
  p_user_id uuid,
  p_billplz_id text,
  p_billplz_url text
)
returns table (invoice_id uuid, intent_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_intent_id uuid;
  v_number text;
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  v_number := 'TU-' || to_char(now(), 'YYYYMMDD') || '-' ||
              substring(gen_random_uuid()::text from 1 for 6);

  insert into public.invoices (
    business_id, number, kind, period_label,
    amount_myr, tax_myr, status, payment_method_id
  )
  values (
    p_business_id, v_number, 'topup', 'Fast Credits top-up',
    p_amount_myr, 0, 'pending', p_payment_method_id
  )
  returning id into v_invoice_id;

  insert into public.billplz_payment_intents (
    business_id, invoice_id, billplz_id, billplz_url,
    kind, credits, amount_myr, status, meta
  )
  values (
    p_business_id, v_invoice_id, p_billplz_id, p_billplz_url,
    'topup', p_credits, p_amount_myr, 'pending',
    jsonb_build_object('user_id', p_user_id)
  )
  returning id into v_intent_id;

  return query select v_invoice_id, v_intent_id;
end;
$$;

grant execute on function public.settings_create_topup_pending(uuid, integer, numeric, uuid, uuid, text, text)
  to authenticated;

-- Complete a Billplz top-up after webhook confirms payment.
create or replace function public.settings_complete_topup_billplz(
  p_billplz_id text
)
returns table (business_id uuid, new_balance integer)
language plpgsql
security definer
set search_path = public
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
     set credit_balance = credit_balance + v_intent.credits
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

grant execute on function public.settings_complete_topup_billplz(text) to service_role;

-- ── Finance: quotes + DuitNow display flag ─────────────────────────────────
alter table public.finance_invoices
  add column if not exists document_kind text not null default 'invoice'
    check (document_kind in ('invoice', 'quote')),
  add column if not exists show_duitnow boolean not null default true,
  add column if not exists converted_from_id uuid references public.finance_invoices (id) on delete set null;

comment on column public.finance_invoices.document_kind is
  'invoice = billable document; quote = proposal convertible to invoice.';
comment on column public.finance_invoices.show_duitnow is
  'When true, public invoice page shows DuitNow pay panel (if business has duitnow_id).';

create index if not exists finance_invoices_quotes_idx
  on public.finance_invoices (business_id, document_kind, created_at desc)
  where deleted_at is null;
