import type { APIRoute } from 'astro';
import { json, requireApiUser } from '../../../../lib/api';
import { isLibraryUuid } from '../../../../lib/library/validation';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = requireApiUser(context);
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await auth.supabase
      .from('user_library_favorites')
      .select('resource_id')
      .eq('user_id', auth.user.id);

    if (error) {
      console.error('[library-favorites-get-error]', error);
      return json({ ok: false, error: 'No se pudieron consultar los favoritos.' }, 500);
    }

    const favorites = (data ?? []).map((row) => row.resource_id);
    return json({ ok: true, favorites });
  } catch (err) {
    console.error('[library-favorites-get-unexpected]', err);
    return json({ ok: false, error: 'Error inesperado al consultar favoritos.' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = requireApiUser(context);
  if (!auth.ok) return auth.response;

  try {
    const body = await context.request.json().catch(() => ({})) as Record<string, unknown>;
    const resourceId = typeof body.resourceId === 'string' ? body.resourceId.trim() : '';

    if (!resourceId || !isLibraryUuid(resourceId)) {
      return json({ ok: false, error: 'Identificador de recurso inválido.' }, 422);
    }

    // Verify resource exists and is published
    const { data: resource, error: resourceError } = await auth.supabase
      .from('library_resources')
      .select('id, is_published')
      .eq('id', resourceId)
      .maybeSingle();

    if (resourceError || !resource || !resource.is_published) {
      return json({ ok: false, error: 'El recurso solicitado no existe o no está publicado.' }, 404);
    }

    const { error: upsertError } = await auth.supabase
      .from('user_library_favorites')
      .upsert(
        {
          user_id: auth.user.id,
          resource_id: resourceId,
        },
        {
          onConflict: 'user_id,resource_id',
          ignoreDuplicates: true,
        }
      );

    if (upsertError) {
      console.error('[library-favorites-post-error]', upsertError);
      return json({ ok: false, error: 'No se pudo guardar el favorito.' }, 500);
    }

    return json({ ok: true, resourceId });
  } catch (err) {
    console.error('[library-favorites-post-unexpected]', err);
    return json({ ok: false, error: 'Error inesperado al agregar favorito.' }, 500);
  }
};
