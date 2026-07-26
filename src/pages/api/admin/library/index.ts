import type { APIRoute } from 'astro';
import { json, requireApiAdmin } from '../../../../lib/api';
import { LIBRARY_ADMIN_SELECT } from '../../../../lib/library/admin';
import { LIBRARY_RESOURCE_TYPES } from '../../../../lib/library/types';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  const page = Math.max(1, Number.parseInt(context.url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(context.url.searchParams.get('pageSize') ?? '20', 10) || 20));
  const from = (page - 1) * pageSize;
  const search = context.url.searchParams.get('q')?.trim();
  const category = context.url.searchParams.get('category')?.trim();
  const type = context.url.searchParams.get('type')?.trim();
  const state = context.url.searchParams.get('state');
  let query = auth.supabase.from('library_resources').select(LIBRARY_ADMIN_SELECT, { count: 'exact' }).order('updated_at', { ascending: false });
  if (search) query = query.or(`title.ilike.%${search.replace(/[%_,()]/g, '')}%,author.ilike.%${search.replace(/[%_,()]/g, '')}%`);
  if (category) query = query.eq('category', category);
  if (type && LIBRARY_RESOURCE_TYPES.includes(type as typeof LIBRARY_RESOURCE_TYPES[number])) query = query.eq('resource_type', type);
  if (state === 'published') query = query.eq('is_published', true);
  if (state === 'draft') query = query.eq('is_published', false);
  const result = await query.range(from, from + pageSize - 1);
  if (result.error) return json({ ok: false, error: 'No se pudo consultar la Biblioteca.' }, 500);
  return json({ ok: true, resources: result.data ?? [], pagination: { page, pageSize, total: result.count ?? 0, pages: Math.ceil((result.count ?? 0) / pageSize) } });
};

// Compatibilidad explícita con la ruta administrativa heredada
// `/api/admin/books/save`. Los archivos ya no se aceptan en el servidor: se
// suben directamente a Drive desde el navegador y este endpoint sólo conserva
// la API de listado.
export const POST: APIRoute = async (context) => {
  const authorization = requireApiAdmin(context);

  if (!authorization.ok) {
    return authorization.response;
  }

  return json(
    {
      ok: false,
      error:
        'La carga de archivos usa el flujo directo de Google Drive de Biblioteca.',
    },
    405,
  );
};
