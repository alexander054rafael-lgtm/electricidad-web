import { downloadDriveFileStream, getAccessToken } from '../services/google-drive.js';
import { applyCorsHeaders, json } from '../security/cors.js';
import type { Env, WorkerContext } from '../types/env.js';

type LibraryResourceRow = {
  id: string;
  cover_drive_file_id: string | null;
  cover_mime_type: string | null;
  is_published: boolean;
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const supabaseUrl = (env: Env) => env.SUPABASE_URL.replace(/\/$/, '');

const supabaseAnonHeaders = (env: Env) => ({
  'Content-Type': 'application/json',
  apikey: env.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  'X-Client-Info': 'indutech-library-worker/1.0',
});

const safeParseJson = <T = unknown>(text: string): T | null => {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const libraryCoverServe = async (
  context: WorkerContext,
): Promise<Response> => {
  const { request, env, operationId } = context;

  // 1. Extract and validate resourceId
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  // Expected pathSegments: ['v1', 'library', 'covers', ':resourceId']
  const coversIndex = pathSegments.indexOf('covers');
  const resourceId = (coversIndex !== -1 && coversIndex < pathSegments.length - 1)
    ? pathSegments[coversIndex + 1]
    : '';

  if (!resourceId || !/^[a-zA-Z0-9_-]{8,128}$/.test(resourceId)) {
    return json(
      { ok: false, code: 'invalid_resource_id', error: 'El identificador del recurso no es válido.', operationId },
      400,
      context,
    );
  }

  // 2 & 3. Fetch resource from Supabase & verify is_published
  let resource: LibraryResourceRow | null = null;
  let fetchFailed = false;
  try {
    const queryUrl = `${supabaseUrl(env)}/rest/v1/library_resources?id=eq.${encodeURIComponent(resourceId)}&select=id,cover_drive_file_id,cover_mime_type,is_published`;
    const resp = await fetch(queryUrl, { headers: supabaseAnonHeaders(env) });
    if (resp.ok) {
      const text = await resp.text().catch(() => '');
      const rows = safeParseJson<LibraryResourceRow[]>(text);
      if (rows && rows.length > 0) {
        resource = rows[0];
      }
    }
  } catch {
    fetchFailed = true;
  }

  if (fetchFailed) {
    return json(
      { ok: false, code: 'database_error', error: 'Error de red al consultar el recurso.', operationId },
      502,
      context,
    );
  }

  if (!resource || !resource.is_published) {
    return json(
      { ok: false, code: 'not_found', error: 'El recurso no existe o no está publicado.', operationId },
      404,
      context,
    );
  }

  // 4. Verify cover_drive_file_id
  if (!resource.cover_drive_file_id) {
    return json(
      { ok: false, code: 'cover_not_found', error: 'El recurso no cuenta con imagen de portada.', operationId },
      404,
      context,
    );
  }

  // 5 & 6. Obtain access token & download media stream from Google Drive
  let fileData: { body: ReadableStream<Uint8Array> | null; contentType: string | null; contentLength: string | null };
  try {
    const accessToken = await getAccessToken(env);
    fileData = await downloadDriveFileStream(accessToken, resource.cover_drive_file_id);
  } catch {
    return json(
      { ok: false, code: 'drive_fetch_failed', error: 'No se pudo obtener la imagen desde Google Drive.', operationId },
      502,
      context,
    );
  }

  // 8. Validate MIME type
  const effectiveMimeType = (fileData.contentType?.split(';')[0].trim().toLowerCase()) || resource.cover_mime_type || 'image/jpeg';

  if (!ALLOWED_IMAGE_MIME_TYPES.has(effectiveMimeType)) {
    return json(
      { ok: false, code: 'unsupported_image_type', error: 'El formato de archivo no es una imagen soportada.', operationId },
      422,
      context,
    );
  }

  // 7. Construct binary response with required cache & security headers
  const headers = new Headers();
  headers.set('Content-Type', effectiveMimeType);
  if (fileData.contentLength) {
    headers.set('Content-Length', fileData.contentLength);
  }
  headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  headers.set('X-Content-Type-Options', 'nosniff');

  const baseResponse = new Response(fileData.body, {
    status: 200,
    headers,
  });

  return applyCorsHeaders(baseResponse, request, env);
};
