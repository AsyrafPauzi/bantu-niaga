-- Cross-module bridges: spec sheets, order→expense link, lead→quote FK,
-- MC vault row, staff leave availability blocks.

-- Operations product spec sheet → Admin Storage
alter table public.operations_products
  add column if not exists spec_file_id uuid references public.admin_files (id) on delete set null;

comment on column public.operations_products.spec_file_id is
  'Datasheet / spec PDF in admin_files vault.';

create index if not exists operations_products_spec_file_idx
  on public.operations_products (business_id, spec_file_id)
  where deleted_at is null and spec_file_id is not null;

-- Finance expense linked to Operations order (manual record-expense flow)
alter table public.finance_transactions
  add column if not exists operations_order_id uuid references public.operations_orders (id) on delete set null;

comment on column public.finance_transactions.operations_order_id is
  'Source operations order when expense was recorded from the order board.';

create unique index if not exists finance_transactions_operations_order_uidx
  on public.finance_transactions (business_id, operations_order_id)
  where deleted_at is null and operations_order_id is not null;

-- Finance quote / invoice linked to Sales lead
alter table public.finance_invoices
  add column if not exists sales_lead_id uuid references public.sales_leads (id) on delete set null;

comment on column public.finance_invoices.sales_lead_id is
  'Sales lead this quote or invoice was created for.';

create index if not exists finance_invoices_sales_lead_idx
  on public.finance_invoices (business_id, sales_lead_id)
  where deleted_at is null and sales_lead_id is not null;

-- HR MC document → admin_files vault row (new uploads)
alter table public.hr_leave_records
  add column if not exists admin_file_id uuid references public.admin_files (id) on delete set null;

comment on column public.hr_leave_records.admin_file_id is
  'Vault metadata row for MC document (legacy mc_document_path kept for back-compat).';

create index if not exists hr_leave_records_admin_file_idx
  on public.hr_leave_records (business_id, admin_file_id)
  where admin_file_id is not null;

-- Optional staff link on booking resources (stylist chair, etc.)
alter table public.operations_booking_resources
  add column if not exists employee_id uuid references public.hr_employees (id) on delete set null;

comment on column public.operations_booking_resources.employee_id is
  'Optional HR employee tied to this bookable resource for leave blocking.';

-- Staff availability blocks (approved leave → Operations calendar)
create table if not exists public.operations_staff_availability_blocks (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  employee_id     uuid not null references public.hr_employees (id) on delete cascade,
  leave_record_id uuid references public.hr_leave_records (id) on delete cascade,
  starts_on       date not null,
  ends_on         date not null,
  reason          text,
  created_at      timestamptz not null default now(),
  constraint operations_staff_availability_dates check (ends_on >= starts_on)
);

comment on table public.operations_staff_availability_blocks is
  'Blocks booking slots when HR leave is approved (resource employee_id match).';

create index if not exists operations_staff_availability_business_dates_idx
  on public.operations_staff_availability_blocks (business_id, starts_on, ends_on);

create unique index if not exists operations_staff_availability_leave_uidx
  on public.operations_staff_availability_blocks (leave_record_id)
  where leave_record_id is not null;

alter table public.operations_staff_availability_blocks enable row level security;

drop policy if exists "operations_staff_availability_select" on public.operations_staff_availability_blocks;
create policy "operations_staff_availability_select" on public.operations_staff_availability_blocks
  for select using (business_id = public.current_business_id());

drop policy if exists "operations_staff_availability_insert" on public.operations_staff_availability_blocks;
create policy "operations_staff_availability_insert" on public.operations_staff_availability_blocks
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );

drop policy if exists "operations_staff_availability_delete" on public.operations_staff_availability_blocks;
create policy "operations_staff_availability_delete" on public.operations_staff_availability_blocks
  for delete using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager', 'hr_officer')
  );
