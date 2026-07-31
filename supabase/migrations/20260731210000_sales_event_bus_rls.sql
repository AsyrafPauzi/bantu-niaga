-- RLS policies for sales event bus: allow authenticated tenant writes.

drop policy if exists "sales_event_dedup_insert" on public.sales_event_dedup;
create policy "sales_event_dedup_insert" on public.sales_event_dedup
  for insert with check (business_id = public.current_business_id());

drop policy if exists "events_outbox_update_dispatched" on public.events_outbox;
create policy "events_outbox_update_dispatched" on public.events_outbox
  for update using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());
