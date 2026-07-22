import type { APIRoute } from 'astro';
import { internalApiError, json, requireApiAdmin } from '../../../../lib/api';
import { ADMIN_BLOCK_TYPES } from '../../../../types/admin';

export const prerender = false;

const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const isSlug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;

  let payload: Record<string, unknown>;
  try {
    payload = await context.request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'JSON invalido.' }, 400);
  }

  if (
    typeof payload.title !== 'string' ||
    payload.title.trim().length < 3 ||
    payload.title.length > 180 ||
    !isSlug(payload.slug)
  ) return json({ error: 'Titulo o slug invalido.' }, 422);

  if (payload.id && !isUuid(payload.id)) return json({ error: 'Identificador invalido.' }, 422);
  if (!Array.isArray(payload.modules) || payload.modules.length > 80) {
    return json({ error: 'Estructura de modulos invalida.' }, 422);
  }

  const lessonSlugs = new Set<string>();
  for (const moduleValue of payload.modules) {
    if (!moduleValue || typeof moduleValue !== 'object') return json({ error: 'Modulo invalido.' }, 422);
    const module = moduleValue as Record<string, unknown>;
    if (typeof module.title !== 'string' || !module.title.trim() || !Array.isArray(module.lessons)) {
      return json({ error: 'Cada modulo necesita titulo y lecciones validas.' }, 422);
    }
    for (const lessonValue of module.lessons) {
      if (!lessonValue || typeof lessonValue !== 'object') return json({ error: 'Leccion invalida.' }, 422);
      const lesson = lessonValue as Record<string, unknown>;
      if (
        typeof lesson.title !== 'string' ||
        !lesson.title.trim() ||
        !isSlug(lesson.slug) ||
        lessonSlugs.has(lesson.slug)
      ) return json({ error: 'Las lecciones necesitan titulos y slugs unicos.' }, 422);
      lessonSlugs.add(lesson.slug);
      if (
        !Array.isArray(lesson.blocks) ||
        lesson.blocks.length > 250 ||
        lesson.blocks.some((block) => {
          if (!block || typeof block !== 'object') return true;
          const candidate = block as Record<string, unknown>;
          return !ADMIN_BLOCK_TYPES.includes(candidate.type as typeof ADMIN_BLOCK_TYPES[number]) ||
            !candidate.content || typeof candidate.content !== 'object';
        })
      ) return json({ error: 'Hay bloques de contenido invalidos.' }, 422);
    }
  }

  const { data, error } = await auth.supabase.rpc('admin_save_course', { p_payload: payload });
  if (error) return internalApiError('admin-courses-save', error, 'No se pudo guardar el curso.');
  return json({ id: data });
};
