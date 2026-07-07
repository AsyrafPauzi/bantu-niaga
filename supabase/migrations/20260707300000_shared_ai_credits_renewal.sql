-- Monthly credit grants for all module AI assistants into the shared business pool.

create or replace function public.ai_assistant_process_renewals()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select ba.id, ba.business_id, ma.slug
      from public.business_addons ba
      join public.marketplace_addons ma on ma.id = ba.addon_id
     where ma.slug in (
       'hr-assistant',
       'marketing-assistant',
       'finance-assistant',
       'operations-assistant',
       'sales-assistant',
       'admin-assistant'
     )
       and ba.status = 'active'
       and ba.next_charge_at is not null
       and ba.next_charge_at <= now()
  loop
    perform public.settings_grant_credits(
      v_row.business_id, 100, v_row.slug || '_monthly_grant', null
    );

    update public.business_addons
       set next_charge_at = now() + interval '30 days',
           updated_at = now()
     where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.ai_assistant_process_renewals() to service_role;

-- Backward-compatible wrapper used by existing cron route.
create or replace function public.hr_assistant_process_renewals()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return public.ai_assistant_process_renewals();
end;
$$;

grant execute on function public.hr_assistant_process_renewals() to service_role;
