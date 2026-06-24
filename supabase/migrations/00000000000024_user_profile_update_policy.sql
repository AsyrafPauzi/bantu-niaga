-- ============================================================================
-- Bantu Niaga — self-service profile updates
-- ============================================================================
-- Allows the authenticated user to update only their own public.users row
-- inside their resolved business. Column-level restrictions stay in the API
-- schema because Postgres RLS cannot limit UPDATE to specific columns.

drop policy if exists users_self_profile_update on public.users;

create policy users_self_profile_update on public.users
  for update to authenticated
  using (
    id = auth.uid()
    and business_id = public.current_business_id()
  )
  with check (
    id = auth.uid()
    and business_id = public.current_business_id()
  );

-- The profile endpoint writes an audit row after a successful update. Keep this
-- narrow so clients cannot forge arbitrary audit entries through the Data API.
drop policy if exists audit_log_insert_profile_update on public.audit_log;

create policy audit_log_insert_profile_update on public.audit_log
  for insert to authenticated
  with check (
    business_id = public.current_business_id()
    and actor_user_id = auth.uid()
    and action = 'settings.profile.update'
    and entity_type = 'user'
    and entity_id = auth.uid()
  );
