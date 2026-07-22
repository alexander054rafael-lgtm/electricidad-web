import type { APIRoute } from 'astro';
import { requireApiAdmin } from '../../../../lib/api';
import type { CourseStatus } from '../../../../types/course';

export const prerender = false;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const allowedStatuses: readonly CourseStatus[] = ['draft', 'published', 'archived'];

const redirectWith = (base: string, key: string, value: string) => {
  const url = new URL(base, 'http://localhost');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
};

const safeReturnPath = (value: FormDataEntryValue | null, courseId: string) => {
  const path = typeof value === 'string' ? value : '';
  const editPath = `/admin/cursos/${courseId}/editar`;
  return path === '/admin/cursos' || path === editPath ? path : '/admin/cursos';
};

const dependencySources = [
  ['course_modules', 'course_id'],
  ['lessons', 'course_id'],
  ['course_enrollments', 'course_id'],
  ['lesson_progress', 'course_id'],
  ['course_progress', 'course_id'],
  ['assessment_attempts', 'course_id'],
  ['game_attempts', 'course_id'],
  ['certificates', 'course_id'],
  ['course_resources', 'course_id'],
  ['course_books', 'course_id'],
] as const;

export const POST: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) {
    return context.locals.user
      ? context.redirect('/mi-aprendizaje?error=forbidden', 303)
      : context.redirect('/iniciar-sesion?redirect=%2Fadmin%2Fcursos', 303);
  }

  const courseId = context.params.id ?? '';
  if (!isUuid(courseId)) return context.redirect('/admin/cursos?error=course_not_found', 303);

  const requestOrigin = context.request.headers.get('origin');
  if (requestOrigin && requestOrigin !== new URL(context.request.url).origin) {
    return context.redirect('/admin/cursos?error=invalid_request', 303);
  }

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return context.redirect('/admin/cursos?error=invalid_request', 303);
  }

  const returnPath = safeReturnPath(form.get('return_to'), courseId);
  const intent = String(form.get('intent') ?? '');
  const { data: course, error: courseError } = await auth.supabase
    .from('courses')
    .select('id,title,status,published_at')
    .eq('id', courseId)
    .maybeSingle();

  if (courseError) {
    if (import.meta.env.DEV) console.error('[admin-course-action-load]', courseError);
    return context.redirect(redirectWith(returnPath, 'error', 'action_failed'), 303);
  }
  if (!course) return context.redirect('/admin/cursos?error=course_not_found', 303);

  if (intent === 'change-status') {
    const nextStatus = String(form.get('status') ?? '') as CourseStatus;
    if (!allowedStatuses.includes(nextStatus)) {
      return context.redirect(redirectWith(returnPath, 'error', 'invalid_status'), 303);
    }

    const publishedAt = nextStatus === 'published' && course.status !== 'published'
      ? new Date().toISOString()
      : course.published_at;
    const { error } = await auth.supabase
      .from('courses')
      .update({
        status: nextStatus,
        published_at: publishedAt,
      })
      .eq('id', courseId);

    if (error) {
      if (import.meta.env.DEV) console.error('[admin-course-action-status]', error);
      return context.redirect(redirectWith(returnPath, 'error', 'status_update_failed'), 303);
    }
    return context.redirect(redirectWith(returnPath, 'status_updated', nextStatus), 303);
  }

  if (intent === 'delete-course') {
    if (form.get('confirmation') !== 'delete-course') {
      return context.redirect(redirectWith(returnPath, 'error', 'delete_confirmation_required'), 303);
    }

    let hasDependencies = false;
    for (const [table, column] of dependencySources) {
      const { count, error } = await auth.supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(column, courseId);

      // Una tabla futura todavía inexistente no impide eliminar. Cualquier otro
      // fallo se trata de forma conservadora para evitar pérdida accidental.
      if (error && error.code !== '42P01') {
        if (import.meta.env.DEV) console.error(`[admin-course-delete-dependency:${table}]`, error);
        return context.redirect(redirectWith(returnPath, 'error', 'dependency_check_failed'), 303);
      }
      if ((count ?? 0) > 0) {
        hasDependencies = true;
        break;
      }
    }

    if (hasDependencies) {
      return context.redirect(redirectWith(returnPath, 'error', 'course_has_dependencies'), 303);
    }

    const { error } = await auth.supabase.from('courses').delete().eq('id', courseId);
    if (error) {
      if (import.meta.env.DEV) console.error('[admin-course-delete]', error);
      return context.redirect(redirectWith(returnPath, 'error', 'delete_failed'), 303);
    }
    return context.redirect('/admin/cursos?deleted=1', 303);
  }

  return context.redirect(redirectWith(returnPath, 'error', 'invalid_request'), 303);
};

export const DELETE: APIRoute = async (context) => {
  const auth = requireApiAdmin(context);
  if (!auth.ok) return auth.response;
  return new Response(null, { status: 405, headers: { allow: 'POST' } });
};
