-- Phase 16: dynamic Technical Library resources.
-- Prerequisite: run 202607220001_library_prerequisites.sql first.
-- Do not run the full Phase 7 migration solely for this table: it contains
-- legacy courses policies that expect a courses.published column.
-- Static sample resources remain exclusively in src/data/books.ts.

create table if not exists public.library_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  author text,
  description text,
  category text not null,
  resource_type text not null,
  level text,
  language text not null default 'Español',
  pages integer,

  drive_file_id text not null unique,
  drive_view_link text,
  drive_download_link text,
  drive_file_name text,
  drive_mime_type text,
  drive_file_size bigint,
  drive_public_permission_id text,

  cover_drive_file_id text unique,
  cover_url text,
  cover_file_name text,
  cover_mime_type text,
  cover_file_size bigint,
  cover_public_permission_id text,

  tags text[] not null default '{}',
  topics text[] not null default '{}',
  badge text,
  accent text not null default '#16a34a',
  allow_download boolean not null default true,
  is_featured boolean not null default false,
  is_published boolean not null default false,
  file_error text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint library_resources_title_not_blank check (btrim(title) <> ''),
  constraint library_resources_slug_not_blank check (btrim(slug) <> ''),
  constraint library_resources_category_not_blank check (btrim(category) <> ''),
  constraint library_resources_language_not_blank check (btrim(language) <> ''),
  constraint library_resources_pages_positive check (pages is null or pages > 0),
  constraint library_resources_drive_size_valid check (drive_file_size is null or drive_file_size >= 0),
  constraint library_resources_cover_size_valid check (cover_file_size is null or cover_file_size >= 0),
  constraint library_resources_level_allowed check (level is null or level in ('Básico','Intermedio','Avanzado')),
  constraint library_resources_type_allowed check (resource_type in ('Libro','Manual','Guía','Catálogo','Ficha técnica','Norma','Documento')),
  constraint library_resources_badge_allowed check (badge is null or badge in ('Nuevo','Popular','Recomendado')),
  constraint library_resources_accent_hex check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  constraint library_resources_pdf_mime check (drive_mime_type is null or drive_mime_type = 'application/pdf'),
  constraint library_resources_cover_mime check (cover_mime_type is null or cover_mime_type in ('image/jpeg','image/png','image/webp')),
  constraint library_resources_publication_consistent check (
    (
      is_published = true
      and drive_view_link is not null
      and drive_download_link is not null
      and drive_public_permission_id is not null
      and (
        cover_drive_file_id is null
        or (cover_url is not null and cover_public_permission_id is not null)
      )
    )
    or (
      is_published = false
      and drive_view_link is null
      and drive_download_link is null
      and cover_url is null
    )
  )
);

create index if not exists library_resources_public_idx
  on public.library_resources(is_published, is_featured desc, updated_at desc);
create index if not exists library_resources_category_idx
  on public.library_resources(category) where is_published = true;

drop trigger if exists library_resources_set_updated_at on public.library_resources;
create trigger library_resources_set_updated_at
  before update on public.library_resources
  for each row execute function public.set_updated_at();

alter table public.library_resources enable row level security;

drop policy if exists "library_resources_public_select" on public.library_resources;
create policy "library_resources_public_select" on public.library_resources
  for select using (is_published = true);

drop policy if exists "library_resources_admin_select" on public.library_resources;
create policy "library_resources_admin_select" on public.library_resources
  for select using (public.current_user_role() = 'admin');

drop policy if exists "library_resources_admin_insert" on public.library_resources;
create policy "library_resources_admin_insert" on public.library_resources
  for insert with check (public.current_user_role() = 'admin');

drop policy if exists "library_resources_admin_update" on public.library_resources;
create policy "library_resources_admin_update" on public.library_resources
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "library_resources_admin_delete" on public.library_resources;
create policy "library_resources_admin_delete" on public.library_resources
  for delete using (public.current_user_role() = 'admin');
