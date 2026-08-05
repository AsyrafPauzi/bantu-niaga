-- Cross-pillar event dispatcher: index undispatched operational events for cron replay.

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
      'order.created'
    );

comment on index public.events_outbox_cross_pillar_undispatched_idx is
  'Fast polling for cross-pillar sync cron (/api/cron/events-dispatch).';
