# Phase 3 — R2 → Google Drive Sync

## Progress

- [x] 1. Create `cloudflare/library-file-worker/src/services/google-drive.ts`
  - [x] Google OAuth access token from refresh token
  - [x] Get or create subfolder (PDFs, Portadas) in Google Drive
  - [x] Resumable upload session from R2 stream (chunked, no full memory)
  - [x] Verify uploaded file metadata
  - [x] Idempotency check (skip if already synced)
- [x] 2. Modify `cloudflare/library-file-worker/src/services/r2-upload.ts`
  - [x] Extend UploadManifest with driveFileId, syncedAt and 'synced' status
- [x] 3. Modify `cloudflare/library-file-worker/src/routes/uploads.ts`
  - [x] Add `syncDrive` function (admin JWT, validate manifest status, call Drive service, update manifest)
- [x] 4. Modify `cloudflare/library-file-worker/src/index.ts`
  - [x] Wire `POST /v1/admin/library/uploads/sync-drive` route
- [x] 5. Modify `src/components/admin/R2UploadTest.astro`
  - [x] Add "Probar copia a Drive" button
  - [x] Status: Validando → Copiando a Drive → Verificando → Completado
  - [x] Show truncated driveFileId
  - [x] Allow cleanup after sync

## Verification
- [x] npm run typecheck (worker)
- [x] npm test (worker)
- [x] npm run deploy:dry-run (worker)
- [ ] npm run check (root) - skip due to Windows cmd limitations
- [ ] npm run build (root) - not applicable for Worker project
- [x] git diff --check (worker)
