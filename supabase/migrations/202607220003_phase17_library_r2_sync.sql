-- Phase 17: R2 → Drive → Supabase integration columns.
-- Prerequisite: run 202607220002_phase16_library_resources.sql first.
-- Adds storage_backend, R2 keys, sync status, SHA-256 hashes.
-- Does NOT remove or alter existing columns.
-- Does NOT modify static books in src/data/books.ts.

-- ── New columns ────────────────────────────────────────────────────
alter table public.library_resources
  add column if not exists storage_backend text not null default 'drive',
  add column if not exists r2_pdf_key text,
  add column if not exists r2_cover_key text,
  add column if not exists file_size_bytes bigint,
  add column if not exists cover_size_bytes bigint,
  add column if not exists file_sha256 text,
  add column if not exists cover_sha256 text,
  add column if not exists sync_status text not null default 'pending',
  add column if not exists sync_error text,
  add column if not exists synced_at timestamptz,
  add column if not exists idempotency_key text;

-- ── Constraints ────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'library_resources_storage_backend_allowed'
  ) then
    alter table public.library_resources
      add constraint library_resources_storage_backend_allowed
        check (storage_backend in ('drive', 'r2-drive'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'library_resources_sync_status_allowed'
  ) then
    alter table public.library_resources
      add constraint library_resources_sync_status_allowed
        check (sync_status in ('pending', 'uploading', 'validating', 'syncing', 'ready', 'failed', 'deleting'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'library_resources_file_size_positive'
  ) then
    alter table public.library_resources
      add constraint library_resources_file_size_positive
        check (file_size_bytes is null or file_size_bytes >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'library_resources_cover_size_positive'
  ) then
    alter table public.library_resources
      add constraint library_resources_cover_size_positive
        check (cover_size_bytes is null or cover_size_bytes >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'library_resources_file_sha256_format'
  ) then
    alter table public.library_resources
      add constraint library_resources_file_sha256_format
        check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'library_resources_cover_sha256_format'
  ) then
    alter table public.library_resources
      add constraint library_resources_cover_sha256_format
        check (cover_sha256 is null or cover_sha256 ~ '^[a-f0-9]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'library_resources_idempotency_key_unique'
  ) then
    alter table public.library_resources
      add constraint library_resources_idempotency_key_unique
        unique (idempotency_key);
  end if;
end $$;

-- ── Indexes ────────────────────────────────────────────────────────
create index if not exists library_resources_sync_status_idx
  on public.library_resources(sync_status)
  where sync_status in ('pending', 'failed');

create index if not exists library_resources_idempotency_key_idx
  on public.library_resources(idempotency_key)
  where idempotency_key is not null;

-- ── Update publication constraint ──────────────────────────────────
-- The existing library_resources_publication_consistent constraint
-- requires drive_view_link, drive_download_link, cover_url to be null
-- when is_published=false. This is fine for both backends since
-- r2-drive also stores Drive links after sync.
-- No changes needed to the publication constraint.
