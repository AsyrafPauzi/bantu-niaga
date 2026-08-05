-- Extend cross-pillar outbox index for invoice.paid + customer lifecycle events.

drop index if exists public.events_outbox_cross_pillar_undispatched_idx;

create index if not exists events_outbox_cross_pillar_undispatched_idx
  on public.events_outbox (emitted_at)
  where dispatched_at is null
    and name in (
      'sale.completed',
      'sale.voided',
      'stock.decrement',
      'stock.restore',
      'leave.approved',
      'leave.rejected',
      'order.completed',
      'order.created',
      'invoice.paid',
      'order.delivered',
      'booking.completed',
      'lead.converted',
      'customer.created',
      'customer.updated',
      'customer.deleted',
      'customer.merged',
      'customer.tag_changed'
    );
