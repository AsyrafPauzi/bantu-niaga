alter table public.admin_compliance_renewal_events
  add column if not exists admin_file_id uuid references public.admin_files(id) on delete set null;

create index if not exists admin_compliance_renewal_file_idx
  on public.admin_compliance_renewal_events (admin_file_id)
  where admin_file_id is not null;
