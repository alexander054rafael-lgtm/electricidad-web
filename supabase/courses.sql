-- InduTech Academy: estructura base para la gestión de cursos.
--
-- Este archivo es compatible con instalaciones nuevas y con la tabla `courses`
-- creada por las migraciones anteriores. No elimina columnas heredadas porque
-- todavía pueden ser utilizadas por las páginas actuales.
-- Debe ejecutarse después de crear `public.profiles` y `public.set_updated_at()`.

begin;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  short_description text,
  description text,
  cover_url text,
  category text,
  level text not null default 'beginner',
  status text not null default 'draft',
  duration_minutes integer not null default 0,
  position integer not null default 0,
  is_featured boolean not null default false,
  instructor_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint courses_level_check
    check (level in ('beginner', 'intermediate', 'advanced')),
  constraint courses_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint courses_duration_minutes_check check (duration_minutes >= 0),
  constraint courses_position_check check (position >= 0)
);

-- Compatibilidad incremental con la tabla existente del proyecto.
alter table public.courses
  add column if not exists cover_url text,
  add column if not exists status text not null default 'draft',
  add column if not exists duration_minutes integer not null default 0,
  add column if not exists position integer not null default 0,
  add column if not exists is_featured boolean not null default false,
  add column if not exists instructor_id uuid references public.profiles(id) on delete set null,
  add column if not exists published_at timestamptz;

-- Evita modificar `updated_at` por la conversión técnica que sigue. El trigger
-- se vuelve a crear al final del archivo.
drop trigger if exists courses_set_updated_at on public.courses;

-- La migración de valores se ejecuta como propietario desde el SQL Editor. Si
-- existe el trigger de defensa administrativa, se suspende solo dentro de esta
-- transacción y se restaura antes del COMMIT.
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.courses'::regclass
      and tgname = 'enforce_admin_write'
      and not tgisinternal
  ) then
    alter table public.courses disable trigger enforce_admin_write;
  end if;
end;
$$;

-- Conserva la información de otras columnas heredadas cuando están disponibles.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'duration_hours'
  ) then
    update public.courses
    set duration_minutes = greatest(0, round(duration_hours * 60)::integer)
    where duration_minutes = 0 and duration_hours > 0;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'published'
  ) then
    update public.courses
    set
      status = case when published then 'published' else 'draft' end,
      published_at = case
        when published then coalesce(published_at, updated_at, created_at, now())
        else published_at
      end
    where status = 'draft';
  end if;
end;
$$;

-- Normaliza los niveles en español usados por el esquema anterior.
alter table public.courses drop constraint if exists courses_level_check;

update public.courses
set level = case level
  when 'Básico' then 'beginner'
  when 'Intermedio' then 'intermediate'
  when 'Avanzado' then 'advanced'
  when 'beginner' then 'beginner'
  when 'intermediate' then 'intermediate'
  when 'advanced' then 'advanced'
  else 'beginner'
end;

alter table public.courses
  add constraint courses_level_check
    check (level in ('beginner', 'intermediate', 'advanced'));

alter table public.courses drop constraint if exists courses_status_check;
update public.courses set status = 'draft'
where status not in ('draft', 'published', 'archived');
alter table public.courses
  add constraint courses_status_check
    check (status in ('draft', 'published', 'archived'));

alter table public.courses drop constraint if exists courses_duration_minutes_check;
update public.courses set duration_minutes = greatest(duration_minutes, 0);
alter table public.courses
  add constraint courses_duration_minutes_check check (duration_minutes >= 0);

alter table public.courses drop constraint if exists courses_position_check;
update public.courses set position = greatest(position, 0);
alter table public.courses
  add constraint courses_position_check check (position >= 0);

-- Se conserva un índice con nombre estable para consultas y mantenimiento.
-- En instalaciones nuevas complementa la restricción UNIQUE declarada arriba.
create index if not exists courses_slug_idx on public.courses(slug);
create index if not exists courses_status_idx on public.courses(status);
create index if not exists courses_category_idx on public.courses(category);
create index if not exists courses_position_idx on public.courses(position);
create index if not exists courses_created_at_idx on public.courses(created_at desc);
create index if not exists courses_instructor_id_idx on public.courses(instructor_id);

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.courses'::regclass
      and tgname = 'enforce_admin_write'
      and not tgisinternal
  ) then
    alter table public.courses enable trigger enforce_admin_write;
  end if;
end;
$$;
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists courses_set_updated_at on public.courses;
-- Reutiliza la función `public.set_updated_at()` existente en el proyecto.
create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

comment on table public.courses is
  'Cursos administrables de InduTech Academy.';
comment on column public.courses.slug is
  'Identificador público único; su restricción UNIQUE crea el índice de slug.';
comment on column public.courses.status is
  'Estado editorial: draft, published o archived.';
comment on column public.courses.cover_url is
  'URL HTTPS de la portada del curso; no representa una subida de archivo.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- El rol administrativo se obtiene de `public.profiles`, nunca de metadata
-- editable del usuario ni de valores enviados por el navegador.
alter table public.courses enable row level security;

-- Retira las políticas de esquemas anteriores antes de instalar las definitivas.
drop policy if exists "courses_public_read" on public.courses;
drop policy if exists "courses_staff_insert" on public.courses;
drop policy if exists "courses_staff_update" on public.courses;
drop policy if exists "courses_admin_read" on public.courses;
drop policy if exists "courses_admin_insert" on public.courses;
drop policy if exists "courses_admin_update" on public.courses;
drop policy if exists "courses_admin_delete" on public.courses;

-- Visitantes y usuarios autenticados solo pueden consultar cursos publicados.
create policy "courses_public_read"
on public.courses
for select
to anon, authenticated
using (status = 'published');

-- Un administrador puede consultar borradores, publicados y archivados.
create policy "courses_admin_read"
on public.courses
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "courses_admin_insert"
on public.courses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "courses_admin_update"
on public.courses
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "courses_admin_delete"
on public.courses
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Los grants habilitan las operaciones a nivel PostgreSQL; RLS decide qué
-- filas puede leer o modificar cada sesión.
grant usage on schema public to anon, authenticated;
revoke all on table public.courses from anon, authenticated;
grant select on table public.courses to anon;
grant select, insert, update, delete on table public.courses to authenticated;

commit;
