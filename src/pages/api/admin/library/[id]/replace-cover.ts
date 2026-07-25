import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../../lib/api';
import { deleteDriveFile, uploadLibraryCover, verifyDriveManagedUpload, verifyFileBelongsToLibraryFolder, type DriveUploadResult } from '../../../../../lib/google-drive/server';
import { getAdminLibraryResource, LIBRARY_ADMIN_SELECT, replaceLibraryAsset } from '../../../../../lib/library/admin';
import { isSameOriginRequest, isLibraryUuid, parseLibraryUploadTicket, sanitizeLibraryFileName, validateLibraryUploadDescriptor, LibraryValidationError } from '../../../../../lib/library/validation';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!isSameOriginRequest(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  const id = context.params.id ?? '';
  if (!isLibraryUuid(id)) return json({ ok: false, error: 'Identificador inválido.' }, 422);
  let uploaded: DriveUploadResult | undefined;
  try {
    const form = await context.request.formData();
    const file = form.get('cover');
    const ticketValue = form.get('driveUpload') ?? form.get('coverDriveUpload');
    let originalName = '';
    if (typeof ticketValue === 'string' && ticketValue) {
      const ticket = parseLibraryUploadTicket(ticketValue, 'cover');
      if (!ticket) throw new LibraryValidationError('Referencia inválida.');
      uploaded = await verifyDriveManagedUpload(ticket.id, ticket.uploadNonce, 'cover');
      originalName = ticket.originalName;
    } else if (file instanceof File && file.size) {
      validateLibraryUploadDescriptor('cover', file.name, file.type, file.size);
      uploaded = await uploadLibraryCover(file);
      originalName = sanitizeLibraryFileName(file.name, 'portada');
    } else return json({ ok: false, error: 'Selecciona una portada válida.' }, 422);
    const result = await replaceLibraryAsset(auth.supabase, id, 'cover', uploaded, originalName);
    uploaded = undefined;
    return json({ ok: true, ...result });
  } catch (error) {
    if (uploaded) await Promise.allSettled([deleteDriveFile(uploaded.id)]);
    if (error instanceof LibraryValidationError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: 'No se pudo reemplazar la portada.' }, 422);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!isSameOriginRequest(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  const id = context.params.id ?? '';
  if (!isLibraryUuid(id)) return json({ ok: false, error: 'Identificador inválido.' }, 422);
  try {
    const resource = await getAdminLibraryResource(auth.supabase, id);
    if (!resource.cover_drive_file_id) return json({ ok: true, resource });
    await verifyFileBelongsToLibraryFolder(resource.cover_drive_file_id, 'cover');
    const cleared = await auth.supabase.from('library_resources').update({
      cover_drive_file_id: null, cover_url: null, cover_file_name: null, cover_mime_type: null, cover_file_size: null, cover_public_permission_id: null, file_error: null,
    }).eq('id', id).select(LIBRARY_ADMIN_SELECT).single();
    if (cleared.error) throw cleared.error;
    try {
      await deleteDriveFile(resource.cover_drive_file_id);
    } catch (error) {
      const driveError = error as { code?: number; response?: { status?: number } };
      if (driveError.code !== 404 && driveError.response?.status !== 404) {
        await auth.supabase.from('library_resources').update({
          cover_drive_file_id: resource.cover_drive_file_id,
          cover_url: resource.cover_url ?? null,
          cover_file_name: resource.cover_file_name ?? null,
          cover_mime_type: resource.cover_mime_type ?? null,
          cover_file_size: resource.cover_file_size ?? null,
          cover_public_permission_id: resource.cover_public_permission_id ?? null,
          file_error: 'No se pudo eliminar la portada de Google Drive.',
        }).eq('id', id);
        return json({ ok: false, error: 'No se pudo eliminar la portada de Drive.' }, 502);
      }
    }
    return json({ ok: true, resource: cleared.data });
  } catch { return json({ ok: false, error: 'No se pudo eliminar la portada.' }, 422); }
};
