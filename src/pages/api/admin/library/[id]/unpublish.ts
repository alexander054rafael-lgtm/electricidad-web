import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../../lib/api';
import { isLibraryUuid, isSameOriginRequest } from '../../../../../lib/library/validation';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  // Ensure request is from an authenticated admin
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;

  // CSRF / same-origin protection
  if (!isSameOriginRequest(context.request, context.url))
    return json({ ok: false, error: 'Origen de solicitud no permitido.' }, 403);

  const resourceId = context.params.id ?? '';
  if (!isLibraryUuid(resourceId)) return json({ ok: false, error: 'Identificador inválido.' }, 422);

  const adminDb = createSupabaseAdminClient();

  try {
    const updateResult = await adminDb
      .from('library_resources')
      .update({ is_published: false })
      .eq('id', resourceId)
      .select('id,is_published')
      .maybeSingle();

    if (updateResult.error) {
      console.error('[admin-library-unpublish] database update failed', {
        resourceId,
        code: updateResult.error.code,
        message: updateResult.error.message,
        details: updateResult.error.details,
        hint: updateResult.error.hint,
      });

      return json(
        {
          ok: false,
          error: 'Error al despublicar el recurso.',
          code: updateResult.error.code,
          message: updateResult.error.message,
          details: updateResult.error.details,
          hint: updateResult.error.hint,
        },
        500
      );
    }

    if (!updateResult.data) {
      console.error('[admin-library-unpublish] resource not found', {
        resourceId,
        code: 'NOT_FOUND',
        message: 'El recurso no existe.',
        details: null,
        hint: null,
      });

      return json(
        {
          ok: false,
          error: 'El recurso no existe.',
          code: 'NOT_FOUND',
          message: 'El recurso no existe.',
          details: null,
          hint: null,
        },
        404
      );
    }

    console.info('[admin-library-unpublish] resource unpublished successfully', {
      resourceId,
      code: 'SUCCESS',
      message: 'Recurso despublicado exitosamente.',
      details: updateResult.data,
      hint: null,
    });

    return json({
      ok: true,
      resource: updateResult.data,
    });
  } catch (error) {
    const errObj = error as { code?: string; message?: string; details?: unknown; hint?: unknown };
    const message = error instanceof Error ? error.message : String(error);

    console.error('[admin-library-unpublish] unexpected error', {
      resourceId,
      code: errObj.code ?? 'UNKNOWN_ERROR',
      message,
      details: errObj.details ?? null,
      hint: errObj.hint ?? null,
    });

    return json(
      {
        ok: false,
        error: 'Error interno del servidor al despublicar el recurso.',
        code: errObj.code ?? 'UNKNOWN_ERROR',
        message,
        details: errObj.details ?? null,
        hint: errObj.hint ?? null,
      },
      500
    );
  }
};
