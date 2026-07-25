import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../lib/api';
import { createDriveResumableUploadSession, deleteDriveFile, verifyDriveManagedUpload } from '../../../../lib/google-drive/server';
import { isManagedDriveId, isSameOriginRequest, sanitizeLibraryFileName, sanitizePlainText, validateLibraryUploadDescriptor, LibraryValidationError, type LibraryAsset } from '../../../../lib/library/validation';

export const prerender = false;

const toSafeStem = (value: unknown) => sanitizeLibraryFileName(sanitizePlainText(value, 80) || 'recurso', 'recurso')
  .replace(/\.[^.]+$/, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'recurso';

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!isSameOriginRequest(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  try {
    const body = await context.request.json() as { asset?: unknown; title?: unknown; originalName?: unknown; mimeType?: unknown; size?: unknown };
    const asset: LibraryAsset | null = body.asset === 'pdf' || body.asset === 'cover' ? body.asset : null;
    if (!asset) throw new LibraryValidationError('Tipo de archivo inválido.');
    const descriptor = validateLibraryUploadDescriptor(asset, body.originalName, body.mimeType, body.size);
    const extension = descriptor.originalName.split('.').pop()!.toLowerCase();
    const name = `${toSafeStem(body.title)}-${asset}-${crypto.randomUUID()}.${extension}`;
    return json({ ok: true, ...await createDriveResumableUploadSession(name, descriptor.mimeType, descriptor.size, asset) });
  } catch (error) {
    if (error instanceof LibraryValidationError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: 'No se pudo iniciar la subida segura a Google Drive.' }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!isSameOriginRequest(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  try {
    const body = await context.request.json() as { id?: unknown; uploadNonce?: unknown; asset?: unknown };
    const id = typeof body.id === 'string' ? body.id : '';
    const uploadNonce = typeof body.uploadNonce === 'string' ? body.uploadNonce : '';
    const asset: LibraryAsset | null = body.asset === 'pdf' || body.asset === 'cover' ? body.asset : null;
    if (!isManagedDriveId(id) || !uploadNonce || !asset) throw new LibraryValidationError('Archivo temporal inválido.');
    const uploaded = await verifyDriveManagedUpload(id, uploadNonce, asset);
    await deleteDriveFile(uploaded.id);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof LibraryValidationError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: 'No se pudo limpiar el archivo temporal.' }, 422);
  }
};
