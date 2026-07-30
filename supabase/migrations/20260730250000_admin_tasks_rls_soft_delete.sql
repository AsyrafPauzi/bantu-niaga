-- Allow owners/managers to soft-delete tasks (same pattern as admin_task_columns).

drop policy if exists "admin_tasks_update" on public.admin_tasks;

create policy "admin_tasks_update" on public.admin_tasks
  for update
  using (
    business_id = public.current_business_id()
    and deleted_at is null
    and (
      public.current_role() in ('owner', 'manager')
      or assignee_user_id = auth.uid()
    )
  )
  with check (
    business_id = public.current_business_id()
  );
