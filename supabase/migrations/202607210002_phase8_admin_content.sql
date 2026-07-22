alter table public.courses
  add column if not exists short_description text not null default '',
  add column if not exists category text not null default 'Electricidad Industrial',
  add column if not exists level text not null default 'Básico',
  add column if not exists duration_hours numeric(7,2) not null default 0,
  add column if not exists instructor_name text not null default '',
  add column if not exists cover_path text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.courses drop constraint if exists courses_level_check;
alter table public.courses add constraint courses_level_check check (level in ('Básico','Intermedio','Avanzado'));

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.course_modules(id) on delete cascade,
  slug text not null,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '',
  estimated_minutes integer not null default 10 check (estimated_minutes between 1 and 1440),
  position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create table if not exists public.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  type text not null check (type in ('heading','paragraph','list','image','gallery','video','formula','table','note','tip','warning','danger','example','steps','resource','assessment','game','book')),
  content jsonb not null default '{}',
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  title text not null, author text not null, description text not null default '', category text not null,
  level text not null default 'Básico' check (level in ('Básico','Intermedio','Avanzado')),
  book_type text not null default 'Libro', language text not null default 'Español', pages integer not null default 1 check (pages > 0),
  publication_year integer check (publication_year between 1800 and 2200), tags text[] not null default '{}',
  cover_path text, pdf_path text, file_size_bytes bigint check (file_size_bytes >= 0), allow_download boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.course_books (course_id uuid references public.courses(id) on delete cascade, book_id uuid references public.books(id) on delete cascade, primary key(course_id,book_id));
create table if not exists public.module_books (module_id uuid references public.course_modules(id) on delete cascade, book_id uuid references public.books(id) on delete cascade, primary key(module_id,book_id));
create table if not exists public.lesson_books (lesson_id uuid references public.lessons(id) on delete cascade, book_id uuid references public.books(id) on delete cascade, primary key(lesson_id,book_id));

create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(), course_id uuid references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade, bucket text not null, object_path text not null unique,
  original_name text not null, mime_type text not null, size_bytes bigint not null check (size_bytes >= 0),
  resource_type text not null, created_by uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now()
);

create index if not exists course_modules_order_idx on public.course_modules(course_id,position);
create index if not exists lessons_order_idx on public.lessons(module_id,position);
create index if not exists lesson_blocks_order_idx on public.lesson_blocks(lesson_id,position);
create index if not exists books_status_idx on public.books(status,updated_at desc);

alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_blocks enable row level security;
alter table public.books enable row level security;
alter table public.course_books enable row level security;
alter table public.module_books enable row level security;
alter table public.lesson_books enable row level security;
alter table public.course_resources enable row level security;

create policy "modules_read_published_or_staff" on public.course_modules for select using (exists(select 1 from public.courses c where c.id=course_id and (c.published or public.current_user_role() in ('instructor','admin'))));
create policy "modules_staff_write" on public.course_modules for all using (public.current_user_role() in ('instructor','admin')) with check (public.current_user_role() in ('instructor','admin'));
create policy "lessons_read_published_or_staff" on public.lessons for select using (status='published' or public.current_user_role() in ('instructor','admin'));
create policy "lessons_staff_write" on public.lessons for all using (public.current_user_role() in ('instructor','admin')) with check (public.current_user_role() in ('instructor','admin'));
create policy "blocks_read_published_or_staff" on public.lesson_blocks for select using (exists(select 1 from public.lessons l where l.id=lesson_id and (l.status='published' or public.current_user_role() in ('instructor','admin'))));
create policy "blocks_staff_write" on public.lesson_blocks for all using (public.current_user_role() in ('instructor','admin')) with check (public.current_user_role() in ('instructor','admin'));
create policy "books_read_published_or_staff" on public.books for select using (status='published' or public.current_user_role() in ('instructor','admin'));
create policy "books_staff_write" on public.books for all using (public.current_user_role() in ('instructor','admin')) with check (public.current_user_role() in ('instructor','admin'));
create policy "course_books_read" on public.course_books for select using (true);
create policy "course_books_staff_write" on public.course_books for all using (public.current_user_role() in ('instructor','admin')) with check (public.current_user_role() in ('instructor','admin'));
create policy "module_books_read" on public.module_books for select using (true);
create policy "module_books_staff_write" on public.module_books for all using (public.current_user_role() in ('instructor','admin')) with check (public.current_user_role() in ('instructor','admin'));
create policy "lesson_books_read" on public.lesson_books for select using (true);
create policy "lesson_books_staff_write" on public.lesson_books for all using (public.current_user_role() in ('instructor','admin')) with check (public.current_user_role() in ('instructor','admin'));
create policy "resources_read_owner_staff" on public.course_resources for select using (public.current_user_role() in ('instructor','admin') or exists(select 1 from public.course_enrollments e where e.user_id=auth.uid() and e.course_id=course_resources.course_id and e.status<>'cancelled'));
create policy "resources_staff_write" on public.course_resources for all using (public.current_user_role() in ('instructor','admin')) with check (public.current_user_role() in ('instructor','admin'));

drop trigger if exists course_modules_set_updated_at on public.course_modules;
create trigger course_modules_set_updated_at before update on public.course_modules for each row execute function public.set_updated_at();
drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at before update on public.lessons for each row execute function public.set_updated_at();
drop trigger if exists lesson_blocks_set_updated_at on public.lesson_blocks;
create trigger lesson_blocks_set_updated_at before update on public.lesson_blocks for each row execute function public.set_updated_at();
drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at before update on public.books for each row execute function public.set_updated_at();

create or replace function public.admin_save_course(p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_role text := public.current_user_role(); v_user uuid := auth.uid(); v_course_id uuid;
  v_module jsonb; v_lesson jsonb; v_block jsonb; v_module_id uuid; v_lesson_id uuid; v_book text;
  v_module_position integer := 0; v_lesson_position integer; v_block_position integer;
begin
  if v_role not in ('instructor','admin') then raise exception 'Staff role required'; end if;
  if char_length(trim(coalesce(p_payload->>'title',''))) not between 3 and 180 then raise exception 'Invalid title'; end if;
  if coalesce(p_payload->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Invalid slug'; end if;
  if jsonb_array_length(coalesce(p_payload->'modules','[]'::jsonb)) > 80 then raise exception 'Too many modules'; end if;
  v_course_id := nullif(p_payload->>'id','')::uuid;
  if v_course_id is null then
    insert into public.courses(slug,title,short_description,description,category,level,duration_hours,instructor_name,cover_path,published,total_lessons,created_by,updated_by)
    values(p_payload->>'slug',trim(p_payload->>'title'),left(coalesce(p_payload->>'shortDescription',''),300),left(coalesce(p_payload->>'description',''),8000),coalesce(p_payload->>'category','Electricidad Industrial'),coalesce(p_payload->>'level','Básico'),greatest(0,coalesce((p_payload->>'durationHours')::numeric,0)),left(coalesce(p_payload->>'instructorName',''),160),nullif(p_payload->>'coverPath',''),coalesce((p_payload->>'published')::boolean,false),0,v_user,v_user)
    returning id into v_course_id;
  else
    update public.courses set slug=p_payload->>'slug',title=trim(p_payload->>'title'),short_description=left(coalesce(p_payload->>'shortDescription',''),300),description=left(coalesce(p_payload->>'description',''),8000),category=coalesce(p_payload->>'category','Electricidad Industrial'),level=coalesce(p_payload->>'level','Básico'),duration_hours=greatest(0,coalesce((p_payload->>'durationHours')::numeric,0)),instructor_name=left(coalesce(p_payload->>'instructorName',''),160),cover_path=nullif(p_payload->>'coverPath',''),published=coalesce((p_payload->>'published')::boolean,false),updated_by=v_user where id=v_course_id;
    if not found then raise exception 'Course not found'; end if;
    delete from public.course_modules where course_id=v_course_id;
    delete from public.course_books where course_id=v_course_id;
  end if;

  for v_book in select jsonb_array_elements_text(coalesce(p_payload->'bookIds','[]'::jsonb)) loop insert into public.course_books(course_id,book_id) values(v_course_id,v_book::uuid) on conflict do nothing; end loop;
  for v_module in select * from jsonb_array_elements(coalesce(p_payload->'modules','[]'::jsonb)) loop
    insert into public.course_modules(course_id,title,description,position) values(v_course_id,left(trim(coalesce(v_module->>'title','Módulo')),160),left(coalesce(v_module->>'description',''),2000),v_module_position) returning id into v_module_id;
    for v_book in select jsonb_array_elements_text(coalesce(v_module->'bookIds','[]'::jsonb)) loop insert into public.module_books(module_id,book_id) values(v_module_id,v_book::uuid) on conflict do nothing; end loop;
    v_lesson_position := 0;
    for v_lesson in select * from jsonb_array_elements(coalesce(v_module->'lessons','[]'::jsonb)) loop
      if jsonb_array_length(coalesce(v_lesson->'blocks','[]'::jsonb)) > 250 then raise exception 'Too many blocks'; end if;
      insert into public.lessons(course_id,module_id,slug,title,description,estimated_minutes,position,status) values(v_course_id,v_module_id,v_lesson->>'slug',left(trim(coalesce(v_lesson->>'title','Lección')),180),left(coalesce(v_lesson->>'description',''),3000),greatest(1,least(1440,coalesce((v_lesson->>'estimatedMinutes')::integer,10))),v_lesson_position,case when v_lesson->>'status'='published' then 'published' else 'draft' end) returning id into v_lesson_id;
      for v_book in select jsonb_array_elements_text(coalesce(v_lesson->'bookIds','[]'::jsonb)) loop insert into public.lesson_books(lesson_id,book_id) values(v_lesson_id,v_book::uuid) on conflict do nothing; end loop;
      v_block_position := 0;
      for v_block in select * from jsonb_array_elements(coalesce(v_lesson->'blocks','[]'::jsonb)) loop
        insert into public.lesson_blocks(lesson_id,type,content,position) values(v_lesson_id,v_block->>'type',coalesce(v_block->'content','{}'::jsonb),v_block_position);
        v_block_position := v_block_position+1;
      end loop;
      v_lesson_position := v_lesson_position+1;
    end loop;
    v_module_position := v_module_position+1;
  end loop;
  update public.courses set total_lessons=(select count(*) from public.lessons where course_id=v_course_id),updated_at=now() where id=v_course_id;
  return v_course_id;
end;
$$;
revoke all on function public.admin_save_course(jsonb) from public;
grant execute on function public.admin_save_course(jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('course-covers','course-covers',true,5242880,array['image/jpeg','image/png','image/webp']),
('course-images','course-images',true,8388608,array['image/jpeg','image/png','image/webp','image/gif']),
('course-resources','course-resources',false,26214400,array['application/pdf','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']),
('lesson-videos','lesson-videos',false,209715200,array['video/mp4','video/webm']),
('book-covers','book-covers',true,5242880,array['image/jpeg','image/png','image/webp']),
('book-pdfs','book-pdfs',false,52428800,array['application/pdf'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "public_read_public_media" on storage.objects for select using (bucket_id in ('course-covers','course-images','book-covers'));
create policy "staff_manage_admin_storage" on storage.objects for all using (bucket_id in ('course-covers','course-images','course-resources','lesson-videos','book-covers','book-pdfs') and public.current_user_role() in ('instructor','admin')) with check (bucket_id in ('course-covers','course-images','course-resources','lesson-videos','book-covers','book-pdfs') and public.current_user_role() in ('instructor','admin') and owner_id=auth.uid());
create policy "students_read_course_files" on storage.objects for select using (bucket_id in ('course-resources','lesson-videos') and exists(select 1 from public.course_enrollments e where e.user_id=auth.uid() and e.course_id::text=(storage.foldername(name))[1] and e.status<>'cancelled'));
create policy "authenticated_read_published_books" on storage.objects for select using (auth.uid() is not null and bucket_id='book-pdfs' and exists(select 1 from public.books b where b.id::text=(storage.foldername(name))[1] and b.status='published'));
