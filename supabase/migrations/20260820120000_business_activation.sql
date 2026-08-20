-- Business first-job activation timestamps.

alter table public.businesses
  add column if not exists first_invoice_sent_at timestamptz,
  add column if not exists first_pos_sale_at timestamptz,
  add column if not exists activated_at timestamptz;

-- first_paid_at may already exist from subscription Billplz migration.
alter table public.businesses
  add column if not exists first_paid_at timestamptz;

comment on column public.businesses.first_invoice_sent_at is
  'First time a finance invoice was sent for this business.';
comment on column public.businesses.first_pos_sale_at is
  'First completed POS sale for this business.';
comment on column public.businesses.activated_at is
  'When the business completed first invoice or POS (whichever earlier).';
comment on column public.businesses.first_paid_at is
  'When the business first became a paying (non-Free) subscriber.';

create or replace function public.business_touch_activation(
  p_business_id uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('invoice', 'pos') then
    raise exception 'invalid activation kind';
  end if;

  if p_kind = 'invoice' then
    update public.businesses
       set first_invoice_sent_at = coalesce(first_invoice_sent_at, now()),
           activated_at = coalesce(activated_at, now())
     where id = p_business_id
       and first_invoice_sent_at is null;
  else
    update public.businesses
       set first_pos_sale_at = coalesce(first_pos_sale_at, now()),
           activated_at = coalesce(activated_at, now())
     where id = p_business_id
       and first_pos_sale_at is null;
  end if;
end;
$$;

revoke all on function public.business_touch_activation(uuid, text) from public;
grant execute on function public.business_touch_activation(uuid, text)
  to authenticated, service_role;

-- Grandfather existing paid tenants for activation metrics.
update public.businesses
   set first_paid_at = coalesce(first_paid_at, created_at)
 where tier is distinct from 'starter'
   and subscription_status in ('active', 'past_due', 'cancelled')
   and first_paid_at is null;
