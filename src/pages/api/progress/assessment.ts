import type { APIRoute } from 'astro';
import { assessments, checkAssessmentAnswer, type QuizAnswer } from '../../../data/assessments';
import { json, readRequestData, requireApiUser } from '../../../lib/api';
export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = requireApiUser(context); if (!auth.ok) return auth.response;
  const payload = await readRequestData(context.request); const courseSlug = String(payload.courseSlug ?? ''); const assessmentSlug = String(payload.assessmentSlug ?? '');
  const assessment = assessments.find((item) => item.courseSlug === courseSlug && item.slug === assessmentSlug);
  if (!assessment || typeof payload.answers !== 'object' || payload.answers === null || Array.isArray(payload.answers)) return json({ error: 'Intento no válido.' }, 400);
  const answers = payload.answers as Record<string, QuizAnswer>;
  const maxScore = assessment.questions.reduce((sum, question) => sum + question.points, 0);
  const score = assessment.questions.reduce((sum, question) => sum + (checkAssessmentAnswer(question, answers[question.id] ?? null) ? question.points : 0), 0);
  const percentage = Math.round((score / maxScore) * 10000) / 100;
  const { data: course } = await auth.supabase.from('courses').select('id, minimum_grade').eq('slug', courseSlug).eq('published', true).single();
  if (!course) return json({ error: 'Curso no encontrado.' }, 404);
  const { data: enrollment } = await auth.supabase.from('course_enrollments').select('id').eq('course_id', course.id).eq('user_id', auth.user.id).neq('status', 'cancelled').maybeSingle();
  if (!enrollment) return json({ error: 'Debes estar inscrito para guardar el resultado.' }, 403);
  const { error } = await auth.supabase.from('assessment_attempts').insert({ user_id: auth.user.id, course_id: course.id, assessment_slug: assessmentSlug, score, max_score: maxScore, percentage, passed: percentage >= Number(course.minimum_grade), answers });
  if (error) return json({ error: 'No fue posible guardar el resultado.' }, 400);
  const { data: certificateCode } = await auth.supabase.rpc('issue_certificate_if_eligible', { p_course_id: course.id });
  return json({ ok: true, score, maxScore, percentage, passed: percentage >= Number(course.minimum_grade), certificateCode });
};
