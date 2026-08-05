-- Allow owners/managers to delete ended boardroom meeting history.

drop policy if exists "boardroom_meetings_delete" on public.boardroom_meetings;
create policy "boardroom_meetings_delete" on public.boardroom_meetings
  for delete using (
    business_id = public.current_business_id()
    and public.current_role() in ('owner', 'manager')
    and status = 'ended'
  );
