# Configuración de Fase 1: Worker y R2

1. Cree el bucket privado `indutech-library-cache` en R2. No habilite acceso público.
2. Copie `cloudflare/library-file-worker/wrangler.toml.example` a
   `wrangler.toml` dentro de esa carpeta y ajuste solo valores no secretos.
3. Instale dependencias en la carpeta del Worker y autentique Wrangler.
4. Configure mediante `wrangler secret put` estos secretos del Worker:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
   Para la prueba de Fase 2, configure también `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` con credenciales S3 de R2 que
   solo tengan acceso al bucket de Biblioteca. Los secretos de Google se
   configurarán en Fase 3, no ahora.
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

Para subida directa desde navegador, configure CORS en el bucket privado con
solo los orígenes de producción y `http://localhost:4321`, método `PUT` y
encabezado `Content-Type`. El bucket no debe hacerse público.
