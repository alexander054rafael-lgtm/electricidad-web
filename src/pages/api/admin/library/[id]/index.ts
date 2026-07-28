import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../../lib/api';
import { books as staticBooks } from '../../../../../data/books';
import { deleteDriveFile, verifyFileBelongsToLibraryFolder } from '../../../../../lib/google-drive/server';
import { getAdminLibraryResource, LIBRARY_ADMIN_SELECT, LibraryOperationError } from '../../../../../lib/library/admin';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { isLibraryUuid, isSameOriginRequest, slugifyLibraryTitle, validateLibraryResourcePatch, LibraryValidationError } from '../../../../../lib/library/validation';

export const prerender = false;
const isDriveMissing = (error: unknown) => {
  const value = error as { code?: number; response?: { status?: number } };
  return value?.code === 404 || value?.response?.status === 404;
};

const authorize = (context: Parameters<APIRoute>[0]) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth;
  if (!isSameOriginRequest(context.request, context.url)) return { ok: false as const, response: json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403) };
  const id = context.params.id ?? '';
  if (!isLibraryUuid(id)) return { ok: false as const, response: json({ ok: false, error: 'Identificador inválido.' }, 422) };
  return { ...auth, id };
};

export const GET: APIRoute = async (context) => {
  const auth = authorize(context);
  if (!auth.ok) return auth.response;
  try { return json({ ok: true, resource: await getAdminLibraryResource(auth.supabase, auth.id) }); }
  catch (error) { return json({ ok: false, error: error instanceof LibraryOperationError ? error.message : 'No se pudo consultar el recurso.' }, error instanceof LibraryOperationError ? 404 : 500); }
};

export const PATCH: APIRoute = async (context) => {
  const auth = authorize(context);
  if (!auth.ok) return auth.response;
  const resourceId = auth.id;
  try {
    const body = await context.request.json() as Record<string, unknown>;
    const updates = validateLibraryResourcePatch(body);
    if (typeof updates.title === 'string' && updates.title.trim()) {
      (updates as Record<string, unknown>).display_slug = slugifyLibraryTitle(updates.title);
    }
    if (typeof updates.slug === 'string') {
      const slug = updates.slug;
      if (staticBooks.some((book) => book.slug === slug)) return json({ ok: false, field: 'slug', error: 'Ese slug pertenece a un recurso de muestra protegido.' }, 409);
      const duplicate = await auth.supabase.from('library_resources').select('id').eq('slug', slug).neq('id', resourceId).maybeSingle();
      if (duplicate.error) throw duplicate.error;
      if (duplicate.data) return json({ ok: false, field: 'slug', error: 'Ya existe un recurso con ese slug.' }, 409);
      updates.slug = slug;
    }

    console.log('[library-patch-input]', {
      resourceId,
      body,
      updates,
    });

    const { data, error: updateError } = await auth.supabase
      .from('library_resources')
      .update(updates)
      .eq('id', resourceId)
      .select(LIBRARY_ADMIN_SELECT)
      .maybeSingle();

    console.log('[library-patch-result]', {
      data,
      updateError,
    });

    if (updateError) {
      console.error('[library-patch-supabase-error]', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
      });

      return json({
        ok: false,
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
      }, 422);
    }

    if (!data) return json({ ok: false, error: 'El recurso dinámico no existe.' }, 404);
    return json({ ok: true, resource: data });
  } catch (error) {
    if (error instanceof LibraryValidationError) return json({ ok: false, ...(error.field ? { field: error.field } : {}), error: error.message }, error.status ?? 422);
    const databaseError = error as { code?: string };
    if (databaseError.code === '23505') return json({ ok: false, field: 'slug', error: 'Ya existe un recurso con ese slug.' }, 409);

    console.error('[library-patch-error]', {
      resourceId: context.params.id,
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      cause: error instanceof Error ? error.cause : undefined,
    });

    return json({
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo actualizar el recurso.',
    }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = authorize(context);
  if (!auth.ok) return auth.response;

  const adminDb = createSupabaseAdminClient();
  const resourceId = auth.id;

  try {
    const resource = await getAdminLibraryResource(adminDb, resourceId);
    const files = [
      { id: resource.drive_file_id, asset: 'pdf' as const },
      ...(resource.cover_drive_file_id ? [{ id: resource.cover_drive_file_id, asset: 'cover' as const }] : []),
    ];
    const incidents: string[] = [];

    for (const file of files) {
      try {
        await verifyFileBelongsToLibraryFolder(file.id, file.asset);
        await deleteDriveFile(file.id);
      } catch (error) {
        if (isDriveMissing(error)) incidents.push(`${file.asset}:missing`);
        else incidents.push(`${file.asset}:delete-failed`);
      }
    }

    if (incidents.some((incident) => incident.endsWith('delete-failed'))) {
      await adminDb.from('library_resources').update({ file_error: `Eliminación parcial: ${incidents.join(', ')}` }).eq('id', resourceId);
      return json({ ok: false, error: 'No se eliminaron todos los archivos de Drive.', incidents }, 502);
    }

    const deleted = await adminDb.from('library_resources').delete().eq('id', resourceId).select('id');
    const deletedRowCount = deleted.data?.length ?? 0;

    if (deleted.error || deletedRowCount === 0) {
      console.error('[admin-library-delete] database delete failed', {
        resourceId,
        code: deleted.error?.code,
        message: deleted.error?.message,
        details: deleted.error?.details,
        hint: deleted.error?.hint,
        deletedRowCount,
      });

      await adminDb.from('library_resources').update({ file_error: 'Los archivos se eliminaron de Drive, pero el registro no pudo eliminarse.' }).eq('id', resourceId);
      return json({ ok: false, error: 'Los archivos se eliminaron, pero no se pudo limpiar el registro.', incidents }, 500);
    }

    console.info('[admin-library-delete] resource deleted successfully', { resourceId, deletedRowCount });
    return json({ ok: true, incidents });
  } catch (error) {
    console.error('[admin-library-delete] error during resource deletion', { resourceId, error: error instanceof Error ? error.message : String(error) });
    return json({ ok: false, error: error instanceof LibraryOperationError ? error.message : 'No se pudo eliminar el recurso.' }, error instanceof LibraryOperationError ? 404 : 422);
  }
};
