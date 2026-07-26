import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../../lib/api';
import { deleteDriveFile, verifyBrowserLibraryUpload, type DriveUploadResult } from '../../../../../lib/google-drive/server';
import { replaceLibraryAsset } from '../../../../../lib/library/admin';
import { isSameOriginRequest, isLibraryUuid, sanitizeLibraryFileName, LibraryValidationError } from '../../../../../lib/library/validation';

export const prerender = false;
const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!isSameOriginRequest(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  const id = context.params.id ?? '';
  if (!isLibraryUuid(id)) return json({ ok: false, error: 'Identificador inválido.' }, 422);
  let uploaded: DriveUploadResult | undefined;
  try {
    const body = await context.request.json() as { driveFileId?: unknown };
    const fileId = typeof body.driveFileId === 'string' ? body.driveFileId : '';
    if (!DRIVE_ID_PATTERN.test(fileId)) throw new LibraryValidationError('El archivo subido no es válido.');
    uploaded = await verifyBrowserLibraryUpload(fileId, 'pdf');
    const result = await replaceLibraryAsset(auth.supabase, id, 'pdf', uploaded, sanitizeLibraryFileName(uploaded.name, 'documento.pdf'));
    uploaded = undefined;
    return json({ ok: true, ...result });
  } catch (error) {
    if (uploaded) await Promise.allSettled([deleteDriveFile(uploaded.id)]);
    if (error instanceof LibraryValidationError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: 'No se pudo reemplazar el PDF.' }, 422);
  }
};
