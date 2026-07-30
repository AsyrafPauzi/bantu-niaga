-- Finance: Billplz checkout intents for customer invoices + supporting document link.

alter table public.finance_invoices
  add column if not exists admin_file_id uuid references public.admin_files (id) on delete set null;

comment on column public.finance_invoices.admin_file_id is
  'Optional PO, contract, or supporting document from Admin Storage.';

create index if not exists finance_invoices_admin_file_idx
  on public.finance_invoices (business_id, admin_file_id)
  where deleted_at is null and admin_file_id is not null;

-- Separate from billing billplz_payment_intents (platform top-ups).
create table if not exists public.finance_billplz_intents (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,
  finance_invoice_id  uuid not null references public.finance_invoices (id) on delete cascade,
  billplz_id          text not null,
  billplz_url         text not null,
  amount_myr          numeric(12, 2) not null check (amount_myr > 0),
  status              text not null default 'pending'
                      check (status in ('pending', 'paid', 'failed')),
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

create unique index if not exists finance_billplz_intents_billplz_id_idx
  on public.finance_billplz_intents (billplz_id);

create index if not exists finance_billplz_intents_invoice_idx
  on public.finance_billplz_intents (finance_invoice_id, status, created_at desc);

alter table public.finance_billplz_intents enable row level security;

drop policy if exists "finance_billplz_intents_select" on public.finance_billplz_intents;
create policy "finance_billplz_intents_select" on public.finance_billplz_intents
  for select using (business_id = public.current_business_id());

-- Inserts/updates via service role + security definer RPC only.

create or replace function public.finance_complete_billplz(p_billplz_id text)
returns table (business_id uuid, finance_invoice_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.finance_billplz_intents%rowtype;
  v_invoice public.finance_invoices%rowtype;
begin
  select * into v_intent
    from public.finance_billplz_intents
   where billplz_id = p_billplz_id
   for update;

  if not found then
    raise exception 'finance intent not found';
  end if;

  if v_intent.status = 'paid' then
    return query select v_intent.business_id, v_intent.finance_invoice_id;
    return;
  end if;

  select * into v_invoice
    from public.finance_invoices
   where id = v_intent.finance_invoice_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'finance invoice not found';
  end if;

  update public.finance_invoices
     set status = 'paid',
         paid_at = coalesce(paid_at, now())
   where id = v_invoice.id;

  if not exists (
    select 1
      from public.finance_transactions
     where finance_invoice_id = v_invoice.id
       and deleted_at is null
  ) then
    insert into public.finance_transactions (
      business_id, kind, amount_myr, category, description,
      counterparty, payment_method, txn_date, finance_invoice_id, created_by
    )
    values (
      v_invoice.business_id,
      'income',
      v_invoice.total_myr,
      'invoice_payment',
      'Payment for ' || v_invoice.number,
      v_invoice.customer_name,
      'fpx',
      current_date,
      v_invoice.id,
      v_invoice.created_by
    );
  end if;

  update public.finance_billplz_intents
     set status = 'paid', paid_at = now()
   where id = v_intent.id;

  insert into public.audit_log (
    business_id, actor_user_id, action, entity_type, entity_id, diff
  )
  values (
    v_invoice.business_id,
    v_invoice.created_by,
    'finance.invoice.billplz_paid',
    'finance_invoice',
    v_invoice.id,
    jsonb_build_object(
      'billplz_id', p_billplz_id,
      'amount_myr', v_intent.amount_myr
    )
  );

  return query select v_intent.business_id, v_intent.finance_invoice_id;
end;
$$;

grant execute on function public.finance_complete_billplz(text) to service_role;
