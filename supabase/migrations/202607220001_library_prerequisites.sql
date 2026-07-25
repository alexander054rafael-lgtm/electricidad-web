-- Prerrequisitos mínimos para Biblioteca Técnica.
-- Esta migración no altera courses, perfiles, autenticación ni políticas existentes.
-- Puede ejecutarse de forma independiente y repetirse de manera segura.

-- SECURITY DEFINER es necesario porque esta función se evalúa dentro de políticas
-- RLS y debe poder consultar el rol del usuario actual sin depender de una
-- política SELECT sobre profiles (evita recursión o denegaciones por RLS).
-- No acepta parámetros y solo consulta el perfil cuyo id coincide con auth.uid().
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
  limit 1;
$$;

-- Un visitante sin sesión (auth.uid() is null) o un usuario sin perfil obtiene
-- NULL, que no satisface las políticas administrativas de Biblioteca.
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to anon, authenticated;

-- Función genérica para triggers BEFORE UPDATE con columna updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Consultas de verificación manual (no se ejecutan durante la migración):
-- select routine_name
-- from information_schema.routines
-- where routine_schema = 'public'
--   and routine_name in ('current_user_role', 'set_updated_at');
