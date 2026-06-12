-- ============================================================================
-- Bantu Niaga — Marketing pillar M3
-- ============================================================================
-- Phase 3 of the Marketing pillar — CSV import + export with dry-run preview.
--
-- What lands here:
--   1. Minor ALTERs on `customer_csv_imports`:
--        - add `file_size_bytes integer` (recorded at upload time, surfaced
--          in the upload response)
--      The plan calls for a `preview_state jsonb` cache and 24h `expires_at`
--      / `committed_at` columns. M1 already shipped `preview jsonb`,
--      `expires_at` (default now() + 24h), and `committed_at` — those are
--      reused as-is per the "extend, do not duplicate" guardrail. Adding a
--      separate `preview_state` column would be redundant.
--   2. `csv-imports` private Supabase Storage bucket (idempotent insert into
--      storage.buckets).
--   3. Storage RLS policies on `storage.objects` scoped to the bucket +
--      same-business owner/manager (defense-in-depth; the API uses the
--      service-role client for actual I/O).
--   4. `public.marketing_csv_commit(p_business_id, p_user_id, p_import_id,
--      p_rows jsonb)` — atomically:
--        - locks the import row
--        - rejects if expired or already committed
--        - loops over `p_rows->'created'`, inserting each customer +
--          emitting one `customer.created` outbox event per insertion in
--          the same Postgres transaction
--        - sets `status='committed'`, `committed_at=now()`
--        - returns aggregate counts {created, merged, rejected, total}
--          plus the inserted customer ids for the API to reference.
--      Runs as SECURITY INVOKER so RLS on customers + events_outbox still
--      applies; the API has already gated the caller as Owner/Manager.
--      Per Q9, the API filters phone-collision-with-name-mismatch rows
--      into `rejected` upstream (in `lib/marketing/csv-classify.ts`), so
--      the RPC never sees them.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- customer_csv_imports — schema additions
--
-- `expires_at`, `committed_at`, `preview`, `status` already exist (M1).
-- Add `file_size_bytes` so the upload response can echo size + an audit
-- query can spot oversized uploads.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.customer_csv_imports
  add column if not exists file_size_bytes integer;

-- Index used by the "one concurrent in-flight import per business" check
-- (plan §8.6) — looks up the active (uploaded | previewed) imports.
create index if not exists customer_csv_imports_business_active_idx
  on public.customer_csv_imports (business_id)
  where status in ('uploaded', 'previewed');

-- ─────────────────────────────────────────────────────────────────────────
-- csv-imports Supabase Storage bucket
--
-- Private (public=false). Path convention: csv-imports/<business_id>/<id>.csv
-- The upload route uses the service-role client to PUT files into this
-- bucket; the preview route uses the service-role client to GET them.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('csv-imports', 'csv-imports', false)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- storage.objects RLS policies (defense-in-depth)
--
-- The API does its real I/O via the service-role client, which bypasses
-- RLS. These policies exist so an accidental anon/authenticated read
-- via the Supabase Storage REST API still gets refused: only same-
-- business owners/managers can list/select their own bucket folder.
--
-- Path layout: csv-imports/<business_id>/<import_id>.csv
-- (storage.foldername(name))[1] returns "<business_id>".
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "csv_imports_storage_select" on storage.objects;
create policy "csv_imports_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'csv-imports'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "csv_imports_storage_insert" on storage.objects;
create policy "csv_imports_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'csv-imports'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "csv_imports_storage_update" on storage.objects;
create policy "csv_imports_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'csv-imports'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  )
  with check (
    bucket_id = 'csv-imports'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  );

drop policy if exists "csv_imports_storage_delete" on storage.objects;
create policy "csv_imports_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'csv-imports'
    and (storage.foldername(name))[1] = public.current_business_id()::text
    and public.current_role() in ('owner', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- public.marketing_csv_commit
--
-- Atomic apply of the preview's `created` rows.
--
-- Inputs:
--   p_business_id  uuid  — tenant scope; verified against the import row.
--   p_user_id      uuid  — actor for outbox emission + customers.created_by_user_id.
--   p_import_id    uuid  — the customer_csv_imports row.
--   p_rows         jsonb — the preview payload the API already classified:
--                          { summary: {total,created,merged,rejected},
--                            created: [{name, phone_e164, email, address,
--                                       manual_tags[], notes}, ...],
--                            merged:   [...],
--                            rejected: [...] }
--                          Only the `created` array is inserted; `merged`
--                          and `rejected` are pass-through counts so the
--                          response summary matches the preview the user
--                          confirmed.
--
-- Returns one row of aggregate counts plus the array of inserted ids.
--
-- Idempotency: the import row's `committed_at` is the marker. Re-running
-- with a committed import raises 'already_committed'.
--
-- Atomicity: every customers + events_outbox insert lives inside the
-- function body, which is itself a single Postgres transaction. If any
-- insert raises (unique-phone violation, etc.) the whole commit rolls
-- back and the import row stays at status='previewed' — the operator
-- can fix the CSV and retry.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.marketing_csv_commit(
  p_business_id uuid,
  p_user_id     uuid,
  p_import_id   uuid,
  p_rows        jsonb
)
returns table (
  created_count        integer,
  merged_count         integer,
  rejected_count       integer,
  total_count          integer,
  created_customer_ids uuid[]
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_import           record;
  v_row              jsonb;
  v_new_id           uuid;
  v_created_ids      uuid[] := '{}'::uuid[];
  v_created_count    integer := 0;
  v_phone_e164       text;
  v_email            text;
  v_address          text;
  v_notes            text;
  v_manual_tags      text[];
  v_summary          jsonb;
begin
  -- 1. Lock + validate the import row.
  select id, business_id, committed_at, expires_at, status
    into v_import
    from public.customer_csv_imports
    where id = p_import_id
      and business_id = p_business_id
    for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_import.committed_at is not null then
    raise exception 'already_committed' using errcode = 'P0001';
  end if;
  if v_import.expires_at < now() then
    raise exception 'expired' using errcode = 'P0001';
  end if;

  -- 2. Insert every row in p_rows->'created' (one customer + one outbox
  --    event per row) inside the function's implicit transaction.
  for v_row in
    select value from jsonb_array_elements(coalesce(p_rows->'created', '[]'::jsonb))
  loop
    v_phone_e164 := nullif(v_row->>'phone_e164', '');
    v_email      := nullif(v_row->>'email', '');
    v_address    := nullif(v_row->>'address', '');
    v_notes      := nullif(v_row->>'notes', '');

    if v_row ? 'manual_tags' and jsonb_typeof(v_row->'manual_tags') = 'array' then
      v_manual_tags := coalesce(
        (select array_agg(t)
           from jsonb_array_elements_text(v_row->'manual_tags') as t),
        '{}'::text[]
      );
    else
      v_manual_tags := '{}'::text[];
    end if;

    insert into public.customers (
      business_id, name, phone_e164, email, address,
      manual_tags, notes, source, created_by_user_id
    ) values (
      p_business_id,
      v_row->>'name',
      v_phone_e164,
      v_email,
      v_address,
      v_manual_tags,
      v_notes,
      'csv_import',
      p_user_id
    )
    returning id into v_new_id;

    insert into public.events_outbox (
      business_id, name, payload, emitted_by_user_id
    ) values (
      p_business_id,
      'customer.created',
      jsonb_build_object(
        'customer_id', v_new_id,
        'phone_e164',  v_phone_e164,
        'name',        v_row->>'name',
        'source',      'csv_import',
        'import_id',   p_import_id
      ),
      p_user_id
    );

    v_created_ids   := v_created_ids || v_new_id;
    v_created_count := v_created_count + 1;
  end loop;

  -- 3. Stamp the import row as committed (still inside the same txn).
  update public.customer_csv_imports
     set committed_at = now(),
         status       = 'committed'
   where id = p_import_id
     and business_id = p_business_id;

  -- 4. Echo the preview's pass-through counts so the API doesn't have to
  --    re-derive them on the response.
  v_summary := coalesce(p_rows->'summary', '{}'::jsonb);

  return query select
    v_created_count                                        as created_count,
    coalesce((v_summary->>'merged')::integer,   0)         as merged_count,
    coalesce((v_summary->>'rejected')::integer, 0)         as rejected_count,
    coalesce((v_summary->>'total')::integer,
             v_created_count
             + coalesce((v_summary->>'merged')::integer,   0)
             + coalesce((v_summary->>'rejected')::integer, 0)) as total_count,
    v_created_ids                                          as created_customer_ids;
end;
$$;

grant execute on function public.marketing_csv_commit(uuid, uuid, uuid, jsonb)
  to authenticated;
