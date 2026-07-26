# Plan de pruebas de Fase 1

Antes de habilitar fases posteriores, compruebe:

1. `GET /v1/health` devuelve 200 cuando el binding R2 está disponible.
2. Un origen distinto de `ALLOWED_ORIGINS` obtiene 403.
3. OPTIONS desde un origen permitido devuelve 204 y solo los encabezados/métodos
   previstos.
4. Sin Authorization, `/v1/admin/library/status` devuelve 401.
5. Con JWT inválido devuelve 401.
6. Con JWT de alumno devuelve 403.
7. Con JWT de `public.profiles.role = admin` devuelve 200 y no incluye secretos.
8. La subida de Biblioteca existente sigue operando con `drive-browser`.
9. No se crea ningún objeto R2 ni se modifica Google Drive durante esta fase.

Ejecute en el Worker `npm run typecheck`, `npm test` y
`npm run deploy:dry-run`; ejecute en Astro `npm run check`, `npm run build` y
`git diff --check`.
