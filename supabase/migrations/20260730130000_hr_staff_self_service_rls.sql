-- Staff self-service (/hr/me): RLS for linked employees (role = staff).

create policy hr_employees_select_self on public.hr_employees
  for select using (
    business_id = public.current_business_id()
    and deleted_at is null
    and user_id = (select auth.uid())
    and public.current_role() = 'staff'
  );

create policy hr_leave_records_insert_self on public.hr_leave_records
  for insert with check (
    business_id = public.current_business_id()
    and public.current_role() = 'staff'
    and status = 'pending'
    and exists (
      select 1
      from public.hr_employees e
      where e.id = hr_leave_records.employee_id
        and e.business_id = hr_leave_records.business_id
        and e.user_id = (select auth.uid())
        and e.deleted_at is null
    )
  );

create policy hr_leave_balances_select_self on public.hr_leave_balances
  for select using (
    business_id = public.current_business_id()
    and public.current_role() = 'staff'
    and exists (
      select 1
      from public.hr_employees e
      where e.id = hr_leave_balances.employee_id
        and e.business_id = hr_leave_balances.business_id
        and e.user_id = (select auth.uid())
        and e.deleted_at is null
    )
  );

create policy hr_onboarding_items_select_self on public.hr_onboarding_items
  for select using (
    business_id = public.current_business_id()
    and public.current_role() = 'staff'
    and exists (
      select 1
      from public.hr_employees e
      where e.id = hr_onboarding_items.employee_id
        and e.business_id = hr_onboarding_items.business_id
        and e.user_id = (select auth.uid())
        and e.deleted_at is null
    )
  );
