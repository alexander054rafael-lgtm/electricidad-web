import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../../lib/api';
import { LibraryOperationError, unpublishLibraryResource } from '../../../../../lib/library/admin';
import { isLibraryUuid, isSameOriginRequest } from '../../../../../lib/library/validation';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  if (!isSameOriginRequest(context.request, context.url)) return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);
  const id = context.params.id ?? '';
  if (!isLibraryUuid(id)) return json({ ok: false, error: 'Identificador inválido.' }, 422);
  try { return json({ ok: true, resource: await unpublishLibraryResource(auth.supabase, id) }); }
  catch (error) { return json({ ok: false, error: error instanceof LibraryOperationError ? error.message : 'No se pudo despublicar el recurso.' }, 422); }
};
