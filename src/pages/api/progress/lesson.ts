import type { APIRoute } from 'astro';
import { courses, getCourseLessons } from '../../../data/courses';
import { json, readRequestData, requireApiUser } from '../../../lib/api';
export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = requireApiUser(context); if (!auth.ok) return auth.response;
  const payload = await readRequestData(context.request); const courseSlug = String(payload.courseSlug ?? ''); const lessonSlug = String(payload.lessonSlug ?? '');
  const completed = payload.completed !== false && payload.completed !== 'false';
  const localCourse = courses.find((course) => course.slug === courseSlug);
  if (!localCourse || !getCourseLessons(localCourse).some((lesson) => lesson.slug === lessonSlug)) return json({ error: 'Lección no válida.' }, 400);
  const { data: course } = await auth.supabase.from('courses').select('id').eq('slug', courseSlug).eq('published', true).single();
  if (!course) return json({ error: 'Curso no encontrado.' }, 404);
  const { data: enrollment } = await auth.supabase.from('course_enrollments').select('id').eq('course_id', course.id).eq('user_id', auth.user.id).neq('status', 'cancelled').maybeSingle();
  if (!enrollment) return json({ error: 'Debes inscribirte antes de guardar progreso.' }, 403);
  const progressRecord = { user_id: auth.user.id, course_id: course.id, lesson_slug: lessonSlug, status: completed ? 'completed' : 'in_progress', completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
  const { error } = completed
    ? await auth.supabase.from('lesson_progress').upsert(progressRecord, { onConflict: 'user_id,course_id,lesson_slug' })
    : await auth.supabase.from('lesson_progress').upsert(progressRecord, { onConflict: 'user_id,course_id,lesson_slug', ignoreDuplicates: true });
  if (error) return json({ error: 'No fue posible guardar la lección.' }, 400);
  const { data: progress, error: progressError } = await auth.supabase.rpc('recalculate_course_progress', { p_course_id: course.id, p_last_lesson_slug: lessonSlug });
  if (progressError) return json({ error: 'La lección se guardó, pero el progreso no pudo actualizarse.' }, 400);
  if (completed) await auth.supabase.rpc('issue_certificate_if_eligible', { p_course_id: course.id });
  return json({ ok: true, progress });
};
