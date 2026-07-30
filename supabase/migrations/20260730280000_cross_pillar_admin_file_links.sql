-- Cross-pillar links from Finance, Operations, and Sales into admin_files vault.

alter table public.finance_transactions
  add column if not exists admin_file_id uuid references public.admin_files (id) on delete set null;

comment on column public.finance_transactions.admin_file_id is
  'Optional receipt / supporting document from Admin Storage.';

create index if not exists finance_txn_admin_file_idx
  on public.finance_transactions (business_id, admin_file_id)
  where deleted_at is null and admin_file_id is not null;

alter table public.operations_suppliers
  add column if not exists admin_file_id uuid references public.admin_files (id) on delete set null;

comment on column public.operations_suppliers.admin_file_id is
  'Optional contract or agreement PDF from Admin Storage.';

create index if not exists operations_suppliers_admin_file_idx
  on public.operations_suppliers (business_id, admin_file_id)
  where deleted_at is null and admin_file_id is not null;

alter table public.operations_orders
  add column if not exists admin_file_id uuid references public.admin_files (id) on delete set null;

comment on column public.operations_orders.admin_file_id is
  'Optional PO, invoice, or delivery note from Admin Storage.';

create index if not exists operations_orders_admin_file_idx
  on public.operations_orders (business_id, admin_file_id)
  where deleted_at is null and admin_file_id is not null;

alter table public.sales_leads
  add column if not exists admin_file_id uuid references public.admin_files (id) on delete set null;

comment on column public.sales_leads.admin_file_id is
  'Optional quote, brochure, or proposal from Admin Storage.';

create index if not exists sales_leads_admin_file_idx
  on public.sales_leads (business_id, admin_file_id)
  where admin_file_id is not null;
