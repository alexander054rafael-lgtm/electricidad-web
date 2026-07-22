import type { APIRoute } from 'astro';
import { courses, getCourseLessons } from '../../../data/courses';
import { json, readRequestData, requireApiUser } from '../../../lib/api';
export const prerender = false;
const validGames = ['matching', 'sorting', 'synchronous-speed'];
const matchingIds = ['frequency', 'poles', 'speed', 'slip', 'torque'];
const correctOrder = ['safety', 'install', 'power', 'motor', 'parameters', 'tests'];

export const POST: APIRoute = async (context) => {
  const auth = requireApiUser(context); if (!auth.ok) return auth.response;
  const payload = await readRequestData(context.request); const gameSlug = String(payload.gameSlug ?? ''); const courseSlug = String(payload.courseSlug ?? ''); const lessonSlug = String(payload.lessonSlug ?? '');
  const durationSeconds = Number(payload.durationSeconds);
  const evidence = typeof payload.evidence === 'object' && payload.evidence !== null && !Array.isArray(payload.evidence) ? payload.evidence as Record<string, unknown> : {};
  if (!validGames.includes(gameSlug) || !Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 86400) return json({ error: 'Resultado de juego no válido.' }, 400);
  let score = 0; let completed = false;
  if (gameSlug === 'matching') {
    const matchedIds = Array.isArray(evidence.matchedIds) ? evidence.matchedIds.map(String).sort() : [];
    const mistakes = Number(evidence.mistakes);
    completed = matchedIds.length === matchingIds.length && matchedIds.every((id, index) => id === [...matchingIds].sort()[index]);
    if (!completed || !Number.isInteger(mistakes) || mistakes < 0 || mistakes > 1000) return json({ error: 'La evidencia del juego no es válida.' }, 400);
    score = Math.max(0, 100 - mistakes * 2);
  } else if (gameSlug === 'sorting') {
    const order = Array.isArray(evidence.order) ? evidence.order.map(String) : [];
    const moves = Number(evidence.moves);
    completed = order.length === correctOrder.length && order.every((id, index) => id === correctOrder[index]);
    if (!completed || !Number.isInteger(moves) || moves < 0 || moves > 1000) return json({ error: 'La evidencia del procedimiento no es válida.' }, 400);
    score = 100;
  } else {
    const frequency = Number(evidence.frequency); const poles = Number(evidence.poles); const result = Number(evidence.result); const expected = (120 * frequency) / poles;
    completed = Number.isFinite(frequency) && frequency >= 1 && frequency <= 400 && Number.isInteger(poles) && poles >= 2 && poles <= 24 && poles % 2 === 0 && Number.isFinite(result) && Math.abs(result - expected) < 0.001;
    if (!completed) return json({ error: 'Los valores de la calculadora no son válidos.' }, 400);
    score = 100;
  }
  let courseId: string | null = null;
  if (courseSlug) {
    const localCourse = courses.find((course) => course.slug === courseSlug);
    if (!localCourse || (lessonSlug && !getCourseLessons(localCourse).some((lesson) => lesson.slug === lessonSlug))) return json({ error: 'Contexto de lección no válido.' }, 400);
    const { data: course } = await auth.supabase.from('courses').select('id').eq('slug', courseSlug).eq('published', true).single();
    if (!course) return json({ error: 'Curso no encontrado.' }, 404);
    courseId = course.id;
  }
  const { error } = await auth.supabase.from('game_attempts').insert({ user_id: auth.user.id, course_id: courseId, lesson_slug: lessonSlug || null, game_slug: gameSlug, score, duration_seconds: durationSeconds, completed, metadata: evidence });
  return error ? json({ error: 'No fue posible guardar el intento.' }, 400) : json({ ok: true });
};
