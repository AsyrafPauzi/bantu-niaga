-- Add archived_at to operations_orders so completed orders can be hidden from
-- the board without being permanently deleted. Archived records remain readable.

alter table operations_orders
  add column if not exists archived_at timestamptz default null;

comment on column operations_orders.archived_at is
  'When set, the order is archived (hidden from the live board) but not deleted.';
