-- Admin internal notes: pin, link to task/compliance, update policy.

alter table public.admin_internal_notes
  add column if not exists is_pinned boolean not null default false,
  add column if not exists linked_task_id uuid
    references public.admin_tasks(id) on delete set null,
  add column if not exists linked_compliance_id uuid
    references public.admin_compliance_items(id) on delete set null;

create index if not exists admin_internal_notes_pinned_idx
  on public.admin_internal_notes (business_id, is_pinned desc, created_at desc);

drop policy if exists admin_internal_notes_update on public.admin_internal_notes;
create policy admin_internal_notes_update on public.admin_internal_notes
  for update to authenticated
  using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
  );
