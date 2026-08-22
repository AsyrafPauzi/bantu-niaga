-- ============================================================
-- Operations: customer_id link + automatic income recording
-- ============================================================
-- 1. Add nullable customer_id FK to orders and bookings so
--    records can be linked to the canonical customers table.
-- 2. The application layer (PATCH /api/operations/bookings/[id]
--    and orders) will insert finance_transactions rows; no DB
--    trigger needed (avoids cross-pillar trigger coupling).
-- ============================================================

-- operations_orders → customers
alter table public.operations_orders
  add column if not exists customer_id uuid
    references public.customers(id) on delete set null;

create index if not exists operations_orders_customer_id_idx
  on public.operations_orders (customer_id)
  where customer_id is not null;

-- operations_bookings → customers
alter table public.operations_bookings
  add column if not exists customer_id uuid
    references public.customers(id) on delete set null;

create index if not exists operations_bookings_customer_id_idx
  on public.operations_bookings (customer_id)
  where customer_id is not null;

-- Grant select on customer_id columns follows existing table RLS —
-- no extra grants needed (columns inherit the table's RLS policies).
