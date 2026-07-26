import { requireAdmin } from '../auth/admin';
import { deleteUploadOperation, getManifest, saveManifest, type UploadManifest } from '../services/r2-upload';
import { syncFileToDrive } from '../services/google-drive';
import { json } from '../security/cors';
import type { Env, WorkerContext } from '../types/env';

// ── Types ──────────────────────────────────────────────────────────

type EditorialMetadata = {
  title: string;
  slug: string;
  author: string | null;
  description: string | null;
  category: string;
  resourceType: string;
  level: string | null;
  language: string;
  pages: number | null;
  tags: string[];
  topics: string[];
  badge: string | null;
  accent: string;
  allowDownload: boolean;
  isFeatured: boolean;
};

type CompleteRequestBody = {
  idempotencyKey: string;
  pdfUploadId: string;
  pdfObjectKey: string;
  coverUploadId?: string;
  coverObjectKey?: string;
  metadata: EditorialMetadata;
  action: 'draft' | 'publish';
};

type SupabaseInsertPayload = Record<string, unknown>;

// ── Helpers ────────────────────────────────────────────────────────

const supabaseUrl = (env: Env) => env.SUPABASE_URL.replace(/\/$/, '');

const supabaseAdminHeaders = (env: Env) => ({
  'Content-Type': 'application/json',
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'X-Client-Info': 'indutech-library-worker/1.0',
});

const cleanSlug = (slug: string) =>
  slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);

const validateMetadata = (m: EditorialMetadata): string | null => {
  if (!m.title || m.title.trim().length < 3) return 'El título debe tener al menos 3 caracteres.';
  if (!m.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.slug)) return 'El slug solo permite letras minúsculas, números y guiones.';
  if (!m.category) return 'La categoría es obligatoria.';
  if (!m.resourceType) return 'El tipo de recurso es obligatorio.';
  if (!m.language) return 'El idioma es obligatorio.';
  if (m.accent && !/^#[0-9A-Fa-f]{6}$/.test(m.accent)) return 'El color de acento debe ser un hex válido (#RRGGBB).';
  if (m.pages !== null && m.pages !== undefined && (!Number.isInteger(m.pages) || m.pages < 1)) return 'El número de páginas debe ser un entero positivo.';
  return null;
};

const buildInsertPayload = (
  metadata: EditorialMetadata,
  pdfManifest: UploadManifest,
  coverManifest: UploadManifest | undefined,
  pdfDriveFileId: string,
  coverDriveFileId: string | undefined,
  pdfDriveWebViewLink: string | undefined,
  pdfDriveName: string | undefined,
  userId: string,
  action: 'draft' | 'publish',
): SupabaseInsertPayload => ({
  title: metadata.title.trim(),
  slug: cleanSlug(metadata.slug),
  author: metadata.author?.trim() || null,
  description: metadata.description?.trim() || null,
  category: metadata.category,
  resource_type: metadata.resourceType,
  level: metadata.level || null,
  language: metadata.language,
  pages: metadata.pages || null,
  tags: metadata.tags,
  topics: metadata.topics,
  badge: metadata.badge || null,
  accent: metadata.accent || '#16a34a',
  allow_download: metadata.allowDownload,
  is_featured: metadata.isFeatured,
  is_published: false,
  created_by: userId,

  // Drive fields (populated after sync)
  drive_file_id: pdfDriveFileId,
  drive_file_name: pdfDriveName || pdfManifest.filename,
  drive_mime_type: 'application/pdf',
  drive_file_size: pdfManifest.size,
  drive_view_link: pdfDriveWebViewLink || null,

  // Cover Drive fields
  cover_drive_file_id: coverDriveFileId || null,
  cover_file_name: coverManifest?.filename || null,
  cover_mime_type: coverManifest?.mimeType || null,
  cover_file_size: coverManifest?.size || null,

  // R2 sync columns
  storage_backend: 'r2-drive',
  r2_pdf_key: null, // cleared after cleanup
  r2_cover_key: null, // cleared after cleanup
  file_size_bytes: pdfManifest.size,
  cover_size_bytes: coverManifest?.size || null,
  file_sha256: pdfManifest.sha256 || null,
  cover_sha256: coverManifest?.sha256 || null,
  sync_status: 'ready',
  synced_at: new Date().toISOString(),
  file_error: null,
});

const deleteDriveFiles = async (
  env: Env,
  fileIds: string[],
): Promise<void> => {
  if (!fileIds.length) return;
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN } = env;
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) return;

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
        refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });
    if (!tokenResp.ok) return;
    const { access_token } = await tokenResp.json() as { access_token: string };

    await Promise.allSettled(
      fileIds.map((id) =>
        fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${access_token}` },
        }),
      ),
    );
  } catch {
    // Best-effort rollback; R2 objects are preserved for manual recovery.
  }
};

const deleteUploads = async (env: Env, manifests: UploadManifest[]): Promise<void> => {
  await Promise.allSettled(manifests.map((m) => deleteUploadOperation(env, m)));
};

// ── Sync helper ────────────────────────────────────────────────────

type SyncResult = { driveFileId: string; webViewLink?: string; name: string };

const syncManifestToDrive = async (
  env: Env,
  manifest: UploadManifest,
): Promise<SyncResult> => {
  if (manifest.status === 'synced' && manifest.driveFileId) {
    return { driveFileId: manifest.driveFileId, name: manifest.filename };
  }

  const result = await syncFileToDrive(env, {
    uploadId: manifest.uploadId,
    objectKey: manifest.objectKey,
    kind: manifest.kind,
    fileName: manifest.filename,
    mimeType: manifest.mimeType,
    size: manifest.size,
  });

  await saveManifest(env, {
    ...manifest,
    status: 'synced',
    driveFileId: result.driveFileId,
    syncedAt: result.syncedAt,
  });

  return { driveFileId: result.driveFileId, webViewLink: result.webViewLink, name: result.name };
};

// ── Main endpoint ──────────────────────────────────────────────────

export const libraryResourcesComplete = async (
  { request, env, operationId }: WorkerContext,
  origin?: string,
): Promise<Response> => {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return json(
      { ok: false, code: auth.code, error: auth.error, operationId },
      auth.status,
      origin,
    );
  }

  let body: CompleteRequestBody;
  try {
    body = await request.json() as CompleteRequestBody;
  } catch {
    return json(
      { ok: false, code: 'invalid_json', error: 'El cuerpo de la solicitud no es JSON válido.', operationId },
      422,
      origin,
    );
  }

  const { idempotencyKey, pdfUploadId, pdfObjectKey, coverUploadId, coverObjectKey, metadata, action } = body;

  // ── Validate idempotencyKey ──────────────────────────────────────
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return json(
      { ok: false, code: 'invalid_idempotency_key', error: 'La clave de idempotencia no es válida.', operationId },
      422,
      origin,
    );
  }

  // ── Check idempotency ────────────────────────────────────────────
  try {
    const existingUrl = `${supabaseUrl(env)}/rest/v1/library_resources?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,slug,title`;
    const existingResp = await fetch(existingUrl, { headers: supabaseAdminHeaders(env) });
    if (existingResp.ok) {
      const existing = await existingResp.json() as { id: string; slug: string; title: string }[];
      if (existing.length > 0) {
        return json(
          { ok: true, resourceId: existing[0].id, slug: existing[0].slug, title: existing[0].title, idempotent: true, operationId },
          200,
          origin,
        );
      }
    }
  } catch {
    // Continue; idempotency check failure should not block the operation.
  }

  // ── Validate metadata ────────────────────────────────────────────
  if (!metadata || typeof metadata !== 'object') {
    return json(
      { ok: false, code: 'missing_metadata', error: 'Los metadatos editoriales son obligatorios.', operationId },
      422,
      origin,
    );
  }
  const metaError = validateMetadata(metadata);
  if (metaError) {
    return json(
      { ok: false, code: 'invalid_metadata', error: metaError, operationId },
      422,
      origin,
    );
  }

  // ── Validate action ──────────────────────────────────────────────
  if (action !== 'draft' && action !== 'publish') {
    return json(
      { ok: false, code: 'invalid_action', error: 'La acción debe ser draft o publish.', operationId },
      422,
      origin,
    );
  }

  // ── Read PDF manifest ────────────────────────────────────────────
  if (!pdfUploadId || !pdfObjectKey) {
    return json(
      { ok: false, code: 'missing_pdf_upload', error: 'El identificador del PDF es obligatorio.', operationId },
      422,
      origin,
    );
  }
  const pdfManifest = await getManifest(env, pdfUploadId);
  if (!pdfManifest || pdfManifest.objectKey !== pdfObjectKey || pdfManifest.ownerId !== auth.userId) {
    return json(
      { ok: false, code: 'pdf_manifest_not_found', error: 'La operación del PDF no está disponible.', operationId },
      404,
      origin,
    );
  }
  if (pdfManifest.kind !== 'pdf') {
    return json(
      { ok: false, code: 'pdf_kind_mismatch', error: 'El uploadId proporcionado no corresponde a un PDF.', operationId },
      422,
      origin,
    );
  }
  if (pdfManifest.status !== 'validated' && pdfManifest.status !== 'synced') {
    return json(
      { ok: false, code: 'pdf_not_validated', error: 'El PDF debe estar validado antes de completar el recurso.', operationId },
      422,
      origin,
    );
  }

  // ── Read cover manifest (optional) ───────────────────────────────
  let coverManifest: UploadManifest | undefined;
  if (coverUploadId && coverObjectKey) {
    coverManifest = await getManifest(env, coverUploadId);
    if (!coverManifest || coverManifest.objectKey !== coverObjectKey || coverManifest.ownerId !== auth.userId) {
      return json(
        { ok: false, code: 'cover_manifest_not_found', error: 'La operación de la portada no está disponible.', operationId },
        404,
        origin,
      );
    }
    if (coverManifest.kind !== 'cover') {
      return json(
        { ok: false, code: 'cover_kind_mismatch', error: 'El uploadId proporcionado no corresponde a una portada.', operationId },
        422,
        origin,
      );
    }
    if (coverManifest.status !== 'validated' && coverManifest.status !== 'synced') {
      return json(
        { ok: false, code: 'cover_not_validated', error: 'La portada debe estar validada antes de completar el recurso.', operationId },
        422,
        origin,
      );
    }
  }

  // ── Sync PDF to Drive if not already synced ──────────────────────
  let pdfSyncResult: SyncResult;
  try {
    pdfSyncResult = await syncManifestToDrive(env, pdfManifest);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo copiar el PDF a Google Drive.';
    await saveManifest(env, { ...pdfManifest, status: 'failed' });
    return json(
      { ok: false, code: 'pdf_sync_failed', error: message, syncStatus: 'failed', operationId },
      502,
      origin,
    );
  }

  // ── Sync cover to Drive if present and not already synced ────────
  let coverSyncResult: SyncResult | undefined;
  if (coverManifest) {
    try {
      coverSyncResult = await syncManifestToDrive(env, coverManifest);
    } catch (error) {
      // Rollback PDF Drive file if cover sync fails
      await deleteDriveFiles(env, [pdfSyncResult.driveFileId]);
      await saveManifest(env, { ...pdfManifest, status: 'failed' });
      const message = error instanceof Error ? error.message : 'No se pudo copiar la portada a Google Drive.';
      return json(
        { ok: false, code: 'cover_sync_failed', error: message, syncStatus: 'failed', operationId },
        502,
        origin,
      );
    }
  }

  // ── Verify PDF Drive file (size, MIME — do not trust browser) ────
  try {
    const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN } = env;
    if (GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && GOOGLE_OAUTH_REFRESH_TOKEN) {
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
          refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN,
          grant_type: 'refresh_token',
        }),
      });
      if (tokenResp.ok) {
        const { access_token } = await tokenResp.json() as { access_token: string };
        const verifyResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${pdfSyncResult.driveFileId}?fields=id,name,mimeType,size,parents,webViewLink`,
          { headers: { Authorization: `Bearer ${access_token}` } },
        );
        if (verifyResp.ok) {
          const verified = await verifyResp.json() as { id: string; name: string; mimeType: string; size: string; parents?: string[]; webViewLink?: string };
          if (Number(verified.size) !== pdfManifest.size) {
            throw new Error(`Drive PDF size mismatch: expected ${pdfManifest.size}, got ${verified.size}`);
          }
          if (verified.mimeType !== 'application/pdf') {
            throw new Error(`Drive PDF MIME mismatch: expected application/pdf, got ${verified.mimeType}`);
          }
          pdfSyncResult.webViewLink = verified.webViewLink;
          pdfSyncResult.name = verified.name;
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo verificar el PDF en Drive.';
    await deleteDriveFiles(env, [pdfSyncResult.driveFileId, coverSyncResult?.driveFileId].filter(Boolean) as string[]);
    return json(
      { ok: false, code: 'pdf_verification_failed', error: message, syncStatus: 'failed', operationId },
      502,
      origin,
    );
  }

  // ── Verify cover Drive file if present ───────────────────────────
  if (coverSyncResult) {
    try {
      const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN } = env;
      if (GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && GOOGLE_OAUTH_REFRESH_TOKEN) {
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_OAUTH_CLIENT_ID,
            client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
            refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN,
            grant_type: 'refresh_token',
          }),
        });
        if (tokenResp.ok) {
          const { access_token } = await tokenResp.json() as { access_token: string };
          const verifyResp = await fetch(
            `https://www.googleapis.com/drive/v3/files/${coverSyncResult.driveFileId}?fields=id,name,mimeType,size`,
            { headers: { Authorization: `Bearer ${access_token}` } },
          );
          if (verifyResp.ok) {
            const verified = await verifyResp.json() as { id: string; name: string; mimeType: string; size: string };
            const expectedSize = coverManifest?.size ?? 0;
            if (Number(verified.size) !== expectedSize) {
              throw new Error(`Drive cover size mismatch: expected ${expectedSize}, got ${verified.size}`);
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo verificar la portada en Drive.';
      await deleteDriveFiles(env, [pdfSyncResult.driveFileId, coverSyncResult.driveFileId]);
      return json(
        { ok: false, code: 'cover_verification_failed', error: message, syncStatus: 'failed', operationId },
        502,
        origin,
      );
    }
  }

  // ── Check slug uniqueness ────────────────────────────────────────
  try {
    const slugUrl = `${supabaseUrl(env)}/rest/v1/library_resources?slug=eq.${encodeURIComponent(metadata.slug)}&select=id`;
    const slugResp = await fetch(slugUrl, { headers: supabaseAdminHeaders(env) });
    if (slugResp.ok) {
      const slugResult = await slugResp.json() as { id: string }[];
      if (slugResult.length > 0 && slugResult[0].id !== idempotencyKey) {
        return json(
          { ok: false, code: 'slug_taken', error: 'El slug ya está en uso por otro recurso.', field: 'slug', operationId },
          409,
          origin,
        );
      }
    }
  } catch {
    // Continue; slug check failure should not block.
  }

  // ── Build insert payload (all values from Worker, none from browser) ─
  const insertPayload = buildInsertPayload(
    metadata,
    pdfManifest,
    coverManifest,
    pdfSyncResult.driveFileId,
    coverSyncResult?.driveFileId,
    pdfSyncResult.webViewLink,
    pdfSyncResult.name,
    auth.userId,
    action,
  );

  // Add idempotency key
  insertPayload.idempotency_key = idempotencyKey;

  // ── Insert into Supabase ─────────────────────────────────────────
  let resourceId: string;
  try {
    const insertResp = await fetch(`${supabaseUrl(env)}/rest/v1/library_resources`, {
      method: 'POST',
      headers: supabaseAdminHeaders(env),
      body: JSON.stringify(insertPayload),
    });

    if (!insertResp.ok) {
      const insertError = await insertResp.text().catch(() => 'unknown');
      throw new Error(`Supabase insert failed (${insertResp.status}): ${insertError}`);
    }

    const inserted = await insertResp.json() as { id: string }[];
    if (!inserted || !inserted.length || !inserted[0].id) {
      throw new Error('Supabase insert returned no resource ID.');
    }
    resourceId = inserted[0].id;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar el recurso en Supabase.';
    // Rollback: delete Drive files created by this operation
    const driveFilesToDelete = [pdfSyncResult.driveFileId];
    if (coverSyncResult?.driveFileId) driveFilesToDelete.push(coverSyncResult.driveFileId);
    await deleteDriveFiles(env, driveFilesToDelete);
    return json(
      { ok: false, code: 'supabase_insert_failed', error: message, syncStatus: 'failed', operationId },
      502,
      origin,
    );
  }

  // ── Cleanup uploads/pending (only after successful insert) ───────
  const manifestsToClean: UploadManifest[] = [pdfManifest];
  if (coverManifest) manifestsToClean.push(coverManifest);
  await deleteUploads(env, manifestsToClean);

  // ── Response ─────────────────────────────────────────────────────
  return json(
    {
      ok: true,
      resourceId,
      slug: metadata.slug,
      title: metadata.title,
      storageBackend: 'r2-drive',
      syncStatus: 'ready',
      publicationPending: action === 'publish',
      isPublished: false,
      message: action === 'publish'
        ? 'Recurso guardado. La publicación se habilitará en la siguiente fase.'
        : 'Recurso guardado como borrador.',
      operationId,
    },
    201,
    origin,
  );
};
