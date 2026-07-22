import type { APIRoute } from 'astro';
import { courses, getCourseLessons } from '../../../data/courses';
import { json, readRequestData, requireApiUser } from '../../../lib/api';
export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = requireApiUser(context);
  const payload = await readRequestData(context.request);
  const courseSlug = String(payload.courseSlug ?? '');
  const localCourse = courses.find((course) => course.slug === courseSlug);
  const firstLesson = localCourse ? getCourseLessons(localCourse)[0]?.href : null;
  if (!auth.ok) {
    if (!context.request.headers.get('content-type')?.includes('application/json')) return context.redirect(`/login?redirect=${encodeURIComponent(`/cursos/${courseSlug}`)}`, 303);
    return auth.response;
  }
  if (!localCourse) return json({ error: 'Curso no válido.' }, 400);
  const { data: course, error: courseError } = await auth.supabase.from('courses').select('id').eq('slug', courseSlug).eq('published', true).single();
  if (courseError || !course) return json({ error: 'El curso no está disponible para inscripción.' }, 404);
  const { error } = await auth.supabase.from('course_enrollments').upsert({ user_id: auth.user.id, course_id: course.id, status: 'active' }, { onConflict: 'user_id,course_id', ignoreDuplicates: true });
  if (error) return json({ error: 'No fue posible completar la inscripción.' }, 400);
  await auth.supabase.rpc('recalculate_course_progress', { p_course_id: course.id, p_last_lesson_slug: null });
  return context.request.headers.get('content-type')?.includes('application/json') ? json({ ok: true, next: firstLesson }) : context.redirect(firstLesson ?? '/mi-aprendizaje', 303);
};
