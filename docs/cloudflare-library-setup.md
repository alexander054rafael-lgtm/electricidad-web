# Configuración de Fase 1: Worker y R2

1. Cree el bucket privado `indutech-library-cache` en R2. No habilite acceso público.
2. Copie `cloudflare/library-file-worker/wrangler.toml.example` a
   `wrangler.toml` dentro de esa carpeta y ajuste solo valores no secretos.
3. Instale dependencias en la carpeta del Worker y autentique Wrangler.
4. Configure mediante `wrangler secret put` estos secretos del Worker:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
   Los secretos de Google se configurarán en Fase 3, no ahora.
5. Restrinja `ALLOWED_ORIGINS` a los dominios de Vercel reales y
   `http://localhost:4321`. Nunca use `*`.
6. Despliegue el Worker y pruebe `GET /v1/health`.
7. Con una sesión de Supabase de un administrador, pruebe
   `GET /v1/admin/library/status` con el encabezado Authorization Bearer.

En Vercel mantenga `LIBRARY_FILE_BACKEND=drive-browser` y
`PUBLIC_LIBRARY_FILE_BACKEND=drive-browser`. `PUBLIC_CLOUDFLARE_LIBRARY_API_URL`
puede configurarse ya, pero no se consume hasta Fase 2.

No agregue secretos de Cloudflare, Google o Supabase al repositorio, a variables
`PUBLIC_` ni a `wrangler.toml`.
