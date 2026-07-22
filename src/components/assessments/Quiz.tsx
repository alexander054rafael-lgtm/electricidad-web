import { useEffect, useMemo, useState } from 'react';
import { checkAssessmentAnswer, type Assessment, type AssessmentQuestion, type QuizAnswer } from '../../data/assessments';
import QuestionRenderer from './QuestionRenderer';
import QuizResults from './QuizResults';
import styles from './Quiz.module.css';

interface Props { assessment: Assessment }
interface StoredQuiz { current: number; answers: Record<string, QuizAnswer>; finished: boolean; synced?: boolean }

const hasAnswer = (question: AssessmentQuestion, answer: QuizAnswer) => {
  if (question.type === 'ordering') return Array.isArray(answer) && answer.length === question.options.length;
  if (Array.isArray(answer)) return answer.length > 0;
  return answer !== null && answer !== undefined && answer !== '';
};

export default function Quiz({ assessment }: Props) {
  const storageKey = `indutech:assessment:${assessment.courseSlug}:${assessment.slug}`;
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [finished, setFinished] = useState(false);
  const [synced, setSynced] = useState(false);
  const [ready, setReady] = useState(false);
  const question = assessment.questions[current];
  const answer = answers[question?.id] ?? null;

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as StoredQuiz;
        setCurrent(Math.min(Math.max(parsed.current, 0), assessment.questions.length - 1));
        setAnswers(parsed.answers ?? {});
        setFinished(Boolean(parsed.finished));
        setSynced(Boolean(parsed.synced));
      }
    } catch { sessionStorage.removeItem(storageKey); }
    setReady(true);
  }, [assessment.questions.length, storageKey]);

  useEffect(() => {
    if (!ready) return;
    sessionStorage.setItem(storageKey, JSON.stringify({ current, answers, finished, synced } satisfies StoredQuiz));
  }, [answers, current, finished, ready, storageKey, synced]);

  useEffect(() => {
    if (!finished || synced) return;
    fetch('/api/progress/assessment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ courseSlug: assessment.courseSlug, assessmentSlug: assessment.slug, answers }) })
      .then((response) => { if (response.ok) setSynced(true); })
      .catch(() => undefined);
  }, [answers, assessment.courseSlug, assessment.slug, finished, synced]);

  const progress = useMemo(() => Math.round(((current + 1) / assessment.questions.length) * 100), [current, assessment.questions.length]);
  const updateAnswer = (value: QuizAnswer) => setAnswers((items) => ({ ...items, [question.id]: value }));
  const next = () => current === assessment.questions.length - 1 ? setFinished(true) : setCurrent((index) => index + 1);
  const retry = () => { sessionStorage.removeItem(storageKey); setAnswers({}); setCurrent(0); setFinished(false); setSynced(false); };

  if (!ready) return <div className={styles.loading} aria-live="polite">Preparando evaluación…</div>;
  if (finished) return <QuizResults assessment={assessment} answers={answers} isCorrect={checkAssessmentAnswer} onRetry={retry} />;

  return <section className={styles.quiz} aria-labelledby="quiz-title">
    <header className={styles.quizHeader}>
      <div><span>Evaluación interactiva</span><h1 id="quiz-title">{assessment.title}</h1><p>{assessment.description}</p></div>
      <div className={styles.questionCount}><strong>{current + 1}</strong><span>de {assessment.questions.length}</span></div>
    </header>

    <div className={styles.progressHeader}><span>Progreso</span><strong>{progress}%</strong></div>
    <div className={styles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>

    <article className={styles.questionCard}>
      <div className={styles.questionMeta}><span>Pregunta {current + 1}</span><span className={styles.difficulty}>{question.difficulty}</span><span>{question.points} puntos</span></div>
      <h2>{question.prompt}</h2>
      {question.image && <figure className={styles.questionImage}><img src={question.image.src} alt={question.image.alt} loading="lazy" decoding="async" /></figure>}
      <QuestionRenderer question={question} answer={answer} onChange={updateAnswer} />
    </article>

    <footer className={styles.navigation}>
      <button className={styles.secondaryButton} type="button" onClick={() => setCurrent((index) => index - 1)} disabled={current === 0}>Pregunta anterior</button>
      <p aria-live="polite">{hasAnswer(question, answer) ? 'Respuesta seleccionada' : 'Selecciona una respuesta para continuar'}</p>
      <button className={styles.primaryButton} type="button" onClick={next} disabled={!hasAnswer(question, answer)}>{current === assessment.questions.length - 1 ? 'Ver resultado' : 'Siguiente pregunta'}</button>
    </footer>
  </section>;
}
