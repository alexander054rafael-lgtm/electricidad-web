# Plan de migración — Fase 8

1. Aplicar `202607210001_phase7_auth_progress.sql` y después `202607210002_phase8_admin_content.sql`.
2. La segunda migración conserva `courses`; agrega metadatos, módulos, lecciones, bloques, libros y relaciones.
3. Verificar los seis buckets, sus límites MIME/tamaño y las políticas RLS.
4. Promover instructores y administradores únicamente desde un entorno seguro. El registro público crea estudiantes.
5. Probar edición con un instructor y eliminación con un administrador.

La aplicación Astro no usa ni requiere `SUPABASE_SERVICE_ROLE_KEY`.
