-- Service catalogue image (mirrors operations_products.image_file_id)
alter table public.operations_services
  add column if not exists image_file_id uuid
    references public.admin_files (id) on delete set null;

comment on column public.operations_services.image_file_id is
  'Optional service photo from Admin Storage.';

create index if not exists operations_services_image_file_idx
  on public.operations_services (business_id, image_file_id)
  where deleted_at is null and image_file_id is not null;
