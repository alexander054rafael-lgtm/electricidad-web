import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../../lib/api';
import { deleteDriveFile, uploadLibraryPdf, verifyDriveManagedUpload, type DriveUploadResult } from '../../../../../lib/google-drive/server';
import { replaceLibraryAsset } from '../../../../../lib/library/admin';
import { isSameOriginRequest, isLibraryUuid, parseLibraryUploadTicket, validateLibraryUploadDescriptor, sanitizeLibraryFileName, LibraryValidationError } from '../../../../../lib/library/validation';

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
    const file = form.get('pdf');
    const ticketValue = form.get('driveUpload') ?? form.get('pdfDriveUpload');
    let originalName = '';
    if (typeof ticketValue === 'string' && ticketValue) {
      const ticket = parseLibraryUploadTicket(ticketValue, 'pdf');
      if (!ticket) throw new LibraryValidationError('Referencia inválida.');
      uploaded = await verifyDriveManagedUpload(ticket.id, ticket.uploadNonce, 'pdf');
      originalName = ticket.originalName;
    } else if (file instanceof File && file.size) {
      validateLibraryUploadDescriptor('pdf', file.name, file.type, file.size);
      uploaded = await uploadLibraryPdf(file);
      originalName = sanitizeLibraryFileName(file.name, 'documento.pdf');
    } else return json({ ok: false, error: 'Selecciona un PDF válido.' }, 422);
    const result = await replaceLibraryAsset(auth.supabase, id, 'pdf', uploaded, originalName);
    uploaded = undefined;
    return json({ ok: true, ...result });
  } catch (error) {
    if (uploaded) await Promise.allSettled([deleteDriveFile(uploaded.id)]);
    if (error instanceof LibraryValidationError) return json({ ok: false, error: error.message }, error.status);
    return json({ ok: false, error: 'No se pudo reemplazar el PDF.' }, 422);
  }
};
