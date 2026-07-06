-- MC document attachment on staff-submitted leave requests (PNG/JPEG/PDF, max 2 MB).

alter table public.hr_leave_records
  add column if not exists mc_document_path text,
  add column if not exists mc_document_name text,
  add column if not exists mc_document_mime text,
  add column if not exists mc_document_size_bytes bigint
    check (
      mc_document_size_bytes is null
      or (
        mc_document_size_bytes > 0
        and mc_document_size_bytes <= 2097152
      )
    );

comment on column public.hr_leave_records.mc_document_path is
  'Supabase Storage path for staff-uploaded MC document (admin-files bucket).';
