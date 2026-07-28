import { requireAdmin } from '../auth/admin.js';
import { makeDriveFilePublic } from '../services/google-drive.js';
import { json } from '../security/cors.js';
import type { Env, WorkerContext } from '../types/env.js';

type LibraryResourceRow = {
  id: string;
  title: string;
  drive_file_id: string | null;
  drive_public_permission_id: string | null;
  drive_view_link: string | null;
  drive_download_link: string | null;
  cover_drive_file_id: string | null;
  cover_public_permission_id: string | null;
  cover_url: string | null;
  is_published: boolean;
  published_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

type WarningItem = {
  code: string;
  message: string;
};

const supabaseUrl = (env: Env) => env.SUPABASE_URL.replace(/\/$/, '');

const supabaseAdminHeaders = (env: Env) => ({
  'Content-Type': 'application/json',
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'X-Client-Info': 'indutech-library-worker/1.0',
  Prefer: 'return=representation',
});

const safeParseJson = <T = unknown>(text: string): T | null => {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const libraryResourcePublish = async (
  context: WorkerContext,
): Promise<Response> => {
  const { request, env, operationId } = context;

  // 1. Auth check
  const auth = await requireAdmin(request, env);
  if (!auth.ok) {
    return json(
      { ok: false, code: auth.code, stage: 'auth', error: auth.error, operationId },
      auth.status,
      context,
    );
  }

  // 2. Extract resource ID safely from URL: /v1/admin/library/:id/publish
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  // Expected pathSegments: ['v1', 'admin', 'library', ':id', 'publish']
  const idIndex = pathSegments.indexOf('library') + 1;
  const resourceId = (idIndex > 0 && idIndex < pathSegments.length - 1) ? pathSegments[idIndex] : '';

  if (!resourceId || !/^[a-zA-Z0-9_-]{8,128}$/.test(resourceId)) {
    return json(
      { ok: false, code: 'invalid_resource_id', stage: 'request-validation', error: 'El identificador del recurso no es válido.', operationId },
      400,
      context,
    );
  }

  console.info(JSON.stringify({ operationId, resourceId, stage: 'publish-start', status: 'start' }));

  // 3. Load resource from Supabase REST API
  let resource: LibraryResourceRow | null = null;
  try {
    const fetchUrl = `${supabaseUrl(env)}/rest/v1/library_resources?id=eq.${encodeURIComponent(resourceId)}&select=*`;
    const resp = await fetch(fetchUrl, { headers: supabaseAdminHeaders(env) });
    if (resp.ok) {
      const text = await resp.text().catch(() => '');
      const rows = safeParseJson<LibraryResourceRow[]>(text);
      if (rows && rows.length > 0) {
        resource = rows[0];
      }
    }
  } catch (err) {
    console.error(JSON.stringify({ operationId, resourceId, stage: 'resource-load', status: 'error', error: String(err) }));
    return json(
      { ok: false, code: 'resource_load_failed', stage: 'resource-load', error: 'Error al consultar la base de datos.', operationId },
      500,
      context,
    );
  }

  if (!resource) {
    console.warn(JSON.stringify({ operationId, resourceId, stage: 'resource-load', status: 'not_found' }));
    return json(
      { ok: false, code: 'resource_not_found', stage: 'resource-load', error: 'El recurso especificado no existe.', operationId },
      404,
      context,
    );
  }

  console.info(JSON.stringify({ operationId, resourceId, stage: 'resource-load', status: 'success' }));

  if (!resource.drive_file_id) {
    console.warn(JSON.stringify({ operationId, resourceId, stage: 'resource-validation', status: 'missing_pdf' }));
    return json(
      { ok: false, code: 'missing_pdf', stage: 'resource-validation', error: 'El recurso no tiene un archivo PDF asociado.', operationId },
      400,
      context,
    );
  }

  const warnings: WarningItem[] = [];

  // 4. Idempotency and repair check
  const hasHealthyPdfPublic = Boolean(
    resource.is_published &&
    resource.drive_public_permission_id &&
    resource.drive_view_link &&
    resource.drive_download_link,
  );

  if (hasHealthyPdfPublic) {
    console.info(JSON.stringify({ operationId, resourceId, stage: 'publish-success', status: 'idempotent' }));
    return json(
      {
        ok: true,
        operationId,
        resource: {
          id: resource.id,
          is_published: resource.is_published,
          drive_public_permission_id: resource.drive_public_permission_id,
          drive_view_link: resource.drive_view_link,
          drive_download_link: resource.drive_download_link,
        },
        warnings,
      },
      200,
      context,
    );
  }

  // 5 & 6. PDF Permission
  let pdfPermissionId = resource.drive_public_permission_id;
  if (!pdfPermissionId) {
    console.info(JSON.stringify({ operationId, resourceId, stage: 'pdf-permission', status: 'start', driveFileId: resource.drive_file_id }));
    try {
      pdfPermissionId = await makeDriveFilePublic(env, resource.drive_file_id);
      console.info(JSON.stringify({ operationId, resourceId, stage: 'pdf-permission', status: 'success', permissionId: pdfPermissionId }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ operationId, resourceId, stage: 'pdf-permission', status: 'error', error: errMsg }));
      return json(
        {
          ok: false,
          operationId,
          code: 'DRIVE_PERMISSION_FAILED',
          stage: 'pdf-permission',
          error: 'No se pudo otorgar acceso público al archivo PDF en Google Drive.',
          resource: { id: resource.id, is_published: false },
        },
        502,
        context,
      );
    }
  }

  // 7. Public links for PDF
  const pdfViewLink = `https://drive.google.com/file/d/${encodeURIComponent(resource.drive_file_id)}/view`;
  const pdfDownloadLink = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(resource.drive_file_id)}`;

  // 8. Optional Cover Permission
  let coverPermissionId = resource.cover_public_permission_id;
  let coverUrl = resource.cover_url;
  if (resource.cover_drive_file_id) {
    if (!coverPermissionId) {
      console.info(JSON.stringify({ operationId, resourceId, stage: 'cover-permission', status: 'start', coverDriveFileId: resource.cover_drive_file_id }));
      try {
        coverPermissionId = await makeDriveFilePublic(env, resource.cover_drive_file_id);
        coverUrl = `https://drive.google.com/uc?export=view&id=${encodeURIComponent(resource.cover_drive_file_id)}`;
        console.info(JSON.stringify({ operationId, resourceId, stage: 'cover-permission', status: 'success', coverPermissionId }));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(JSON.stringify({ operationId, resourceId, stage: 'cover-permission', status: 'warning', error: errMsg }));
        warnings.push({
          code: 'COVER_PERMISSION_FAILED',
          message: 'El recurso fue publicado, pero la portada no pudo hacerse pública.',
        });
      }
    } else if (!coverUrl) {
      coverUrl = `https://drive.google.com/uc?export=view&id=${encodeURIComponent(resource.cover_drive_file_id)}`;
    }
  }

  // 9. Supabase update
  console.info(JSON.stringify({ operationId, resourceId, stage: 'supabase-update', status: 'start' }));

  const updatePayload: Record<string, unknown> = {
    is_published: true,
    drive_public_permission_id: pdfPermissionId,
    drive_view_link: pdfViewLink,
    drive_download_link: pdfDownloadLink,
    cover_public_permission_id: coverPermissionId || null,
    cover_url: coverUrl || null,
    file_error: null,
    updated_at: new Date().toISOString(),
  };

  try {
    const updateUrl = `${supabaseUrl(env)}/rest/v1/library_resources?id=eq.${encodeURIComponent(resourceId)}`;
    const updateResp = await fetch(updateUrl, {
      method: 'PATCH',
      headers: supabaseAdminHeaders(env),
      body: JSON.stringify(updatePayload),
    });

    if (!updateResp.ok) {
      const errText = await updateResp.text().catch(() => '');
      console.error(JSON.stringify({ operationId, resourceId, stage: 'supabase-update', status: 'error', statusCode: updateResp.status, error: errText }));
      return json(
        {
          ok: false,
          operationId,
          code: 'supabase_update_failed',
          stage: 'supabase-update',
          error: 'No se pudo actualizar el registro en la base de datos.',
          resource: { id: resource.id, is_published: false },
        },
        500,
        context,
      );
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ operationId, resourceId, stage: 'supabase-update', status: 'exception', error: errMsg }));
    return json(
      {
        ok: false,
        operationId,
        code: 'supabase_update_failed',
        stage: 'supabase-update',
        error: 'Error de red al actualizar la base de datos.',
        resource: { id: resource.id, is_published: false },
      },
      500,
      context,
    );
  }

  console.info(JSON.stringify({ operationId, resourceId, stage: 'supabase-update', status: 'success' }));

  // 10. Persistence verification (Reread row)
  console.info(JSON.stringify({ operationId, resourceId, stage: 'supabase-verification', status: 'start' }));
  let rereadResource: LibraryResourceRow | null = null;
  try {
    const fetchUrl = `${supabaseUrl(env)}/rest/v1/library_resources?id=eq.${encodeURIComponent(resourceId)}&select=*`;
    const resp = await fetch(fetchUrl, { headers: supabaseAdminHeaders(env) });
    if (resp.ok) {
      const text = await resp.text().catch(() => '');
      const rows = safeParseJson<LibraryResourceRow[]>(text);
      if (rows && rows.length > 0) {
        rereadResource = rows[0];
      }
    }
  } catch {}

  const isVerified = Boolean(
    rereadResource &&
    rereadResource.is_published === true &&
    rereadResource.drive_public_permission_id &&
    rereadResource.drive_view_link &&
    rereadResource.drive_download_link,
  );

  if (!isVerified) {
    console.error(JSON.stringify({ operationId, resourceId, stage: 'supabase-verification', status: 'failed', rereadResource }));
    return json(
      {
        ok: false,
        operationId,
        code: 'PUBLICATION_PERSISTENCE_FAILED',
        stage: 'supabase-verification',
        error: 'La verificación de publicación en la base de datos falló.',
        resource: { id: resource.id, is_published: false },
      },
      500,
      context,
    );
  }

  console.info(JSON.stringify({ operationId, resourceId, stage: 'publish-success', status: 'success' }));

  return json(
    {
      ok: true,
      operationId,
      resource: {
        id: rereadResource!.id,
        is_published: rereadResource!.is_published,
        drive_public_permission_id: rereadResource!.drive_public_permission_id,
        drive_view_link: rereadResource!.drive_view_link,
        drive_download_link: rereadResource!.drive_download_link,
      },
      warnings,
    },
    200,
    context,
  );
};
