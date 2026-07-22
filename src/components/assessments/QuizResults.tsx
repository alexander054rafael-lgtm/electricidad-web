import type { Assessment, AssessmentQuestion, QuizAnswer } from '../../data/assessments';
import styles from './Quiz.module.css';

interface Props {
  assessment: Assessment;
  answers: Record<string, QuizAnswer>;
  isCorrect: (question: AssessmentQuestion, answer: QuizAnswer) => boolean;
  onRetry: () => void;
}

const answerLabel = (question: AssessmentQuestion, answer: QuizAnswer) => {
  if (answer === null || answer === undefined || (Array.isArray(answer) && answer.length === 0)) return 'Sin respuesta';
  if (question.type === 'true-false') return answer === true ? 'Verdadero' : 'Falso';
  if (question.type === 'numeric') return `${answer} ${question.unit ?? ''}`.trim();
  const ids = Array.isArray(answer) ? answer : [answer];
  return ids.map((id) => question.options.find((option) => option.id === id)?.label ?? String(id)).join(question.type === 'ordering' ? ' → ' : ', ');
};

const correctAnswerLabel = (question: AssessmentQuestion) => {
  if (question.type === 'true-false') return question.correctAnswer ? 'Verdadero' : 'Falso';
  if (question.type === 'numeric') return `${question.correctAnswer} ${question.unit ?? ''}`.trim();
  const ids = question.type === 'single-choice'
    ? [question.correctAnswer]
    : question.type === 'multiple-choice'
      ? question.correctAnswers
      : question.correctOrder;
  return ids.map((id) => question.options.find((option) => option.id === id)?.label ?? id).join(question.type === 'ordering' ? ' → ' : ', ');
};

export default function QuizResults({ assessment, answers, isCorrect, onRetry }: Props) {
  const correct = assessment.questions.filter((question) => isCorrect(question, answers[question.id] ?? null));
  const score = correct.reduce((total, question) => total + question.points, 0);
  const total = assessment.questions.reduce((sum, question) => sum + question.points, 0);
  const percentage = Math.round((score / total) * 100);

  return <section className={styles.results} aria-labelledby="quiz-result-title">
    <div className={styles.resultHero}>
      <span className={styles.resultEyebrow}>Evaluación finalizada</span>
      <h1 id="quiz-result-title">Tu resultado</h1>
      <div className={styles.scoreRing} style={{ '--score': `${percentage * 3.6}deg` } as React.CSSProperties}><strong>{percentage}%</strong><span>{score} de {total} puntos</span></div>
      <div className={styles.stats}>
        <div><strong>{correct.length}</strong><span>Correctas</span></div>
        <div><strong>{assessment.questions.length - correct.length}</strong><span>Incorrectas</span></div>
        <div><strong>{assessment.questions.length}</strong><span>Preguntas</span></div>
      </div>
      <button className={styles.primaryButton} type="button" onClick={onRetry}>Reintentar evaluación</button>
    </div>

    <div className={styles.review}>
      <div><span>Revisión</span><h2>Explicación de respuestas</h2></div>
      {assessment.questions.map((question, index) => {
        const answer = answers[question.id] ?? null;
        const correctAnswer = isCorrect(question, answer);
        return <article className={`${styles.reviewItem} ${correctAnswer ? styles.correct : styles.incorrect}`} key={question.id}>
          <header><span>{correctAnswer ? '✓ Correcta' : '× Incorrecta'}</span><small>{question.points} puntos</small></header>
          <h3>{index + 1}. {question.prompt}</h3>
          <p><strong>Tu respuesta:</strong> {answerLabel(question, answer)}</p>
          {!correctAnswer && <p><strong>Respuesta correcta:</strong> {correctAnswerLabel(question)}</p>}
          <div className={styles.explanation}><strong>Explicación</strong><p>{question.explanation}</p></div>
        </article>;
      })}
    </div>
  </section>;
}
