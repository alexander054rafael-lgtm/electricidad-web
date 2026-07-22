# Plan de migración — Fase 7

1. Crear un proyecto Supabase y ejecutar, en orden, las migraciones de `supabase/migrations`.
2. Copiar `.env.example` a `.env` y configurar únicamente URL, clave pública `anon` y URL del sitio.
3. Configurar en Supabase Auth las URL permitidas para `/auth/callback` y `/restablecer-contrasena`.
4. Verificar que el trigger cree un perfil `student` por cada usuario nuevo y que las políticas RLS estén activas.
5. Sincronizar el catálogo inicial incluido en la migración con los slugs de `src/data/courses.ts`.
6. Crear roles `instructor` y `admin` mediante SQL seguro o consola administrativa; los usuarios no pueden cambiar su propio rol.
7. Probar registro, confirmación, recuperación y cierre de sesión antes de habilitar tráfico real.
8. Validar inscripción, progreso, evaluaciones y juegos con dos estudiantes distintos para comprobar aislamiento RLS.
9. Verificar certificados por código y confirmar que no se exponen datos privados adicionales.

La aplicación no necesita ni acepta una clave `service_role` en el navegador. Las operaciones normales usan la sesión del usuario y la clave pública `anon` bajo RLS.
