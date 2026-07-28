import type { APIRoute } from 'astro';
import { json, requireApiUser } from '../../../../lib/api';
import { isLibraryUuid } from '../../../../lib/library/validation';

export const prerender = false;

export const DELETE: APIRoute = async (context) => {
  const auth = requireApiUser(context);
  if (!auth.ok) return auth.response;

  const resourceId = context.params.resourceId ?? '';
  if (!resourceId || !isLibraryUuid(resourceId)) {
    return json({ ok: false, error: 'Identificador de recurso inválido.' }, 422);
  }

  try {
    const { error } = await auth.supabase
      .from('user_library_favorites')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('resource_id', resourceId);

    if (error) {
      console.error('[library-favorites-delete-error]', error);
      return json({ ok: false, error: 'No se pudo eliminar el favorito.' }, 500);
    }

    return json({ ok: true, resourceId });
  } catch (err) {
    console.error('[library-favorites-delete-unexpected]', err);
    return json({ ok: false, error: 'Error inesperado al eliminar favorito.' }, 500);
  }
};
