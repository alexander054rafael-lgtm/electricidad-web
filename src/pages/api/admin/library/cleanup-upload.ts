import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../lib/api';
import { deleteDriveFile, verifyBrowserLibraryUpload } from '../../../../lib/google-drive/server';
import { isSameOriginRequest, LibraryValidationError } from '../../../../lib/library/validation';

export const prerender = false;
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!isSameOriginRequest(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  try {
    const body = await context.request.json() as { files?: unknown };
    const files = Array.isArray(body.files) ? body.files : [];
    for (const file of files) {
      if (!file || typeof file !== 'object') throw new LibraryValidationError('Solicitud de limpieza inválida.');
      const value = file as { id?: unknown; asset?: unknown };
      if (typeof value.id !== 'string' || !DRIVE_ID_PATTERN.test(value.id) || (value.asset !== 'pdf' && value.asset !== 'cover')) throw new LibraryValidationError('Solicitud de limpieza inválida.');
      const verified = await verifyBrowserLibraryUpload(value.id, value.asset);
      await deleteDriveFile(verified.id);
    }
    return json({ ok: true });
  } catch (error) {
    if (error instanceof LibraryValidationError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: 'No se pudieron limpiar los archivos temporales.' }, 422);
  }
};
