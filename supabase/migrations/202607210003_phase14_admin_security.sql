-- Phase 14: keep role changes and administrative writes outside the browser.

-- A signed-in user may edit profile presentation fields, never their role.
revoke update (role) on table public.profiles from anon, authenticated;

-- The panel does not expose destructive course operations in this phase.
drop policy if exists "courses_admin_delete" on public.courses;

-- Administrative content writes are restricted to the admin profile role.
drop policy if exists "courses_staff_insert" on public.courses;
drop policy if exists "courses_staff_update" on public.courses;
create policy "courses_admin_insert" on public.courses
  for insert with check (public.current_user_role() = 'admin');
create policy "courses_admin_update" on public.courses
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "modules_staff_write" on public.course_modules;
create policy "modules_admin_insert" on public.course_modules
  for insert with check (public.current_user_role() = 'admin');
create policy "modules_admin_update" on public.course_modules
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "lessons_staff_write" on public.lessons;
create policy "lessons_admin_insert" on public.lessons
  for insert with check (public.current_user_role() = 'admin');
create policy "lessons_admin_update" on public.lessons
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "blocks_staff_write" on public.lesson_blocks;
create policy "blocks_admin_insert" on public.lesson_blocks
  for insert with check (public.current_user_role() = 'admin');
create policy "blocks_admin_update" on public.lesson_blocks
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "books_staff_write" on public.books;
create policy "books_admin_insert" on public.books
  for insert with check (public.current_user_role() = 'admin');
create policy "books_admin_update" on public.books
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "course_books_staff_write" on public.course_books;
create policy "course_books_admin_insert" on public.course_books
  for insert with check (public.current_user_role() = 'admin');
create policy "course_books_admin_update" on public.course_books
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "module_books_staff_write" on public.module_books;
create policy "module_books_admin_insert" on public.module_books
  for insert with check (public.current_user_role() = 'admin');
create policy "module_books_admin_update" on public.module_books
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "lesson_books_staff_write" on public.lesson_books;
create policy "lesson_books_admin_insert" on public.lesson_books
  for insert with check (public.current_user_role() = 'admin');
create policy "lesson_books_admin_update" on public.lesson_books
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "resources_staff_write" on public.course_resources;
create policy "resources_admin_insert" on public.course_resources
  for insert with check (public.current_user_role() = 'admin');
create policy "resources_admin_update" on public.course_resources
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Security-definer content functions must still reject non-admin callers.
create or replace function public.enforce_admin_content_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception using errcode = '42501', message = 'Administrator role required';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'courses', 'course_modules', 'lessons', 'lesson_blocks', 'books',
    'course_books', 'module_books', 'lesson_books', 'course_resources'
  ] loop
    execute format('drop trigger if exists enforce_admin_write on public.%I', table_name);
    execute format(
      'create trigger enforce_admin_write before insert or update or delete on public.%I for each row execute function public.enforce_admin_content_write()',
      table_name
    );
  end loop;
end;
$$;

-- Storage accepts admin uploads/updates, but no client-side deletion policy.
drop policy if exists "staff_manage_admin_storage" on storage.objects;
create policy "admin_insert_admin_storage" on storage.objects
  for insert with check (
    bucket_id in ('course-covers','course-images','course-resources','lesson-videos','book-covers','book-pdfs')
    and public.current_user_role() = 'admin'
    and owner_id = auth.uid()
  );
create policy "admin_update_admin_storage" on storage.objects
  for update using (
    bucket_id in ('course-covers','course-images','course-resources','lesson-videos','book-covers','book-pdfs')
    and public.current_user_role() = 'admin'
  ) with check (
    bucket_id in ('course-covers','course-images','course-resources','lesson-videos','book-covers','book-pdfs')
    and public.current_user_role() = 'admin'
    and owner_id = auth.uid()
  );
