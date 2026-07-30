-- Allow owners/managers to soft-delete task board columns.
-- WITH CHECK must not re-require role on the new row (matches customers / admin_files).

drop policy if exists "admin_task_columns_update" on public.admin_task_columns;

create policy "admin_task_columns_update" on public.admin_task_columns
  for update
  using (
    business_id = public.current_business_id()
    and deleted_at is null
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    business_id = public.current_business_id()
  );
