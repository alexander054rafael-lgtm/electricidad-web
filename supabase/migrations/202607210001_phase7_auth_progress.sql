create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text,
  role text not null default 'student' check (role in ('student', 'instructor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  total_lessons integer not null default 0 check (total_lessons >= 0),
  required_assessment_slugs text[] not null default '{}',
  minimum_grade numeric(5,2) not null default 70 check (minimum_grade between 0 and 100),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  enrolled_at timestamptz not null default now(), completed_at timestamptz,
  unique (user_id, course_id)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade, lesson_slug text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  completed_at timestamptz, updated_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_slug)
);

create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  completed_lessons integer not null default 0 check (completed_lessons >= 0),
  total_lessons integer not null default 0 check (total_lessons >= 0),
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  last_lesson_slug text, status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  updated_at timestamptz not null default now(), unique (user_id, course_id)
);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade, assessment_slug text not null,
  score numeric(8,2) not null check (score >= 0), max_score numeric(8,2) not null check (max_score > 0),
  percentage numeric(5,2) not null check (percentage between 0 and 100), passed boolean not null,
  answers jsonb not null default '{}', created_at timestamptz not null default now()
);

create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null, lesson_slug text, game_slug text not null,
  score integer not null check (score between 0 and 100), duration_seconds integer not null check (duration_seconds >= 0),
  completed boolean not null default false, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade, verification_code text not null unique,
  final_grade numeric(5,2) not null check (final_grade between 0 and 100),
  status text not null default 'issued' check (status in ('issued', 'revoked')),
  issued_at timestamptz not null default now(), unique (user_id, course_id)
);

create index if not exists lesson_progress_user_course_idx on public.lesson_progress(user_id, course_id);
create index if not exists assessment_attempts_user_course_idx on public.assessment_attempts(user_id, course_id, assessment_slug);
create index if not exists game_attempts_user_created_idx on public.game_attempts(user_id, created_at desc);
create index if not exists certificates_code_idx on public.certificates(verification_code);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at before update on public.courses for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role) values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), 'student');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.current_user_role() returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.course_progress enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.game_attempts enable row level security;
alter table public.certificates enable row level security;

create policy "profiles_select_own_or_staff" on public.profiles for select using (id = auth.uid() or public.current_user_role() in ('instructor','admin'));
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, updated_at) on public.profiles to authenticated;

create policy "courses_public_read" on public.courses for select using (published or public.current_user_role() in ('instructor','admin'));
create policy "courses_staff_insert" on public.courses for insert with check (public.current_user_role() in ('instructor','admin'));
create policy "courses_staff_update" on public.courses for update using (public.current_user_role() in ('instructor','admin'));
create policy "courses_admin_delete" on public.courses for delete using (public.current_user_role() = 'admin');

create policy "enrollments_select_own_or_staff" on public.course_enrollments for select using (user_id = auth.uid() or public.current_user_role() in ('instructor','admin'));
create policy "enrollments_insert_own" on public.course_enrollments for insert with check (user_id = auth.uid() and exists (select 1 from public.courses where id = course_id and published));
create policy "lesson_progress_select_own_or_staff" on public.lesson_progress for select using (user_id = auth.uid() or public.current_user_role() in ('instructor','admin'));
create policy "lesson_progress_insert_own" on public.lesson_progress for insert with check (user_id = auth.uid() and exists (select 1 from public.course_enrollments where user_id = auth.uid() and course_id = lesson_progress.course_id and status <> 'cancelled'));
create policy "lesson_progress_update_own" on public.lesson_progress for update using (user_id = auth.uid() and exists (select 1 from public.course_enrollments where user_id = auth.uid() and course_id = lesson_progress.course_id and status <> 'cancelled')) with check (user_id = auth.uid());
create policy "course_progress_select_own_or_staff" on public.course_progress for select using (user_id = auth.uid() or public.current_user_role() in ('instructor','admin'));
create policy "assessment_attempts_select_own_or_staff" on public.assessment_attempts for select using (user_id = auth.uid() or public.current_user_role() in ('instructor','admin'));
create policy "assessment_attempts_insert_own" on public.assessment_attempts for insert with check (user_id = auth.uid() and exists (select 1 from public.course_enrollments where user_id = auth.uid() and course_id = assessment_attempts.course_id and status <> 'cancelled'));
create policy "game_attempts_select_own_or_staff" on public.game_attempts for select using (user_id = auth.uid() or public.current_user_role() in ('instructor','admin'));
create policy "game_attempts_insert_own" on public.game_attempts for insert with check (user_id = auth.uid() and (course_id is null or exists (select 1 from public.course_enrollments where user_id = auth.uid() and course_id = game_attempts.course_id and status <> 'cancelled')));
create policy "certificates_select_own_or_staff" on public.certificates for select using (user_id = auth.uid() or public.current_user_role() in ('instructor','admin'));

create or replace function public.recalculate_course_progress(p_course_id uuid, p_last_lesson_slug text default null)
returns public.course_progress language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_total integer; v_completed integer; v_result public.course_progress;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.course_enrollments where user_id = v_user and course_id = p_course_id and status <> 'cancelled') then raise exception 'Enrollment required'; end if;
  select total_lessons into v_total from public.courses where id = p_course_id and published;
  if v_total is null then raise exception 'Course not found'; end if;
  select count(*) into v_completed from public.lesson_progress where user_id = v_user and course_id = p_course_id and status = 'completed';
  insert into public.course_progress (user_id, course_id, completed_lessons, total_lessons, progress_percent, last_lesson_slug, status)
  values (v_user, p_course_id, v_completed, v_total, case when v_total = 0 then 0 else least(100, round(v_completed * 100.0 / v_total, 2)) end, p_last_lesson_slug, case when v_total > 0 and v_completed >= v_total then 'completed' else 'in_progress' end)
  on conflict (user_id, course_id) do update set completed_lessons = excluded.completed_lessons, total_lessons = excluded.total_lessons, progress_percent = excluded.progress_percent, last_lesson_slug = coalesce(excluded.last_lesson_slug, public.course_progress.last_lesson_slug), status = excluded.status, updated_at = now()
  returning * into v_result;
  update public.course_enrollments set status = v_result.status, completed_at = case when v_result.status = 'completed' then coalesce(completed_at, now()) else null end where user_id = v_user and course_id = p_course_id;
  return v_result;
end;
$$;

create or replace function public.issue_certificate_if_eligible(p_course_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_course public.courses; v_grade numeric(5,2); v_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_course from public.courses where id = p_course_id;
  if not exists (select 1 from public.course_progress where user_id = v_user and course_id = p_course_id and progress_percent = 100) then return null; end if;
  if exists (
    select 1 from unnest(v_course.required_assessment_slugs) required_slug
    where not exists (select 1 from public.assessment_attempts a where a.user_id = v_user and a.course_id = p_course_id and a.assessment_slug = required_slug and a.passed)
  ) then return null; end if;
  select coalesce(avg(best_percentage), 100) into v_grade from (
    select max(percentage) best_percentage from public.assessment_attempts where user_id = v_user and course_id = p_course_id and assessment_slug = any(v_course.required_assessment_slugs) group by assessment_slug
  ) scores;
  if v_grade < v_course.minimum_grade then return null; end if;
  insert into public.certificates (user_id, course_id, verification_code, final_grade)
  values (v_user, p_course_id, encode(gen_random_bytes(12), 'hex'), v_grade)
  on conflict (user_id, course_id) do update set final_grade = excluded.final_grade
  returning verification_code into v_code;
  return v_code;
end;
$$;

create or replace function public.verify_certificate(p_code text)
returns table (verification_code text, student_name text, course_title text, final_grade numeric, issued_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select c.verification_code, p.full_name, co.title, c.final_grade, c.issued_at, c.status
  from public.certificates c join public.profiles p on p.id = c.user_id join public.courses co on co.id = c.course_id
  where c.verification_code = p_code and c.status = 'issued';
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;
revoke all on function public.recalculate_course_progress(uuid, text) from public;
grant execute on function public.recalculate_course_progress(uuid, text) to authenticated;
revoke all on function public.issue_certificate_if_eligible(uuid) from public;
grant execute on function public.issue_certificate_if_eligible(uuid) to authenticated;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

insert into public.courses (slug, title, description, total_lessons, required_assessment_slugs, minimum_grade) values
('variadores-de-frecuencia-desde-cero','Variadores de Frecuencia desde Cero','Selección, instalación, programación y diagnóstico de variadores.',24,array['fundamentos-motores-y-variadores'],70),
('plc-siemens-desde-cero','PLC Siemens desde Cero','Automatización con PLC Siemens S7-1200.',12,'{}',70),
('motores-electricos','Motores Eléctricos','Selección, conexión y mantenimiento de motores.',12,'{}',70),
('automatizacion-industrial','Automatización Industrial','Integración de sensores, actuadores y controladores.',12,'{}',70),
('instrumentacion-industrial','Instrumentación Industrial','Medición, señales y lazos de instrumentación.',12,'{}',70),
('seguridad-electrica','Seguridad Eléctrica','Prevención y control del riesgo eléctrico.',12,'{}',70)
on conflict (slug) do update set title = excluded.title, description = excluded.description, total_lessons = excluded.total_lessons, required_assessment_slugs = excluded.required_assessment_slugs, minimum_grade = excluded.minimum_grade, updated_at = now();
