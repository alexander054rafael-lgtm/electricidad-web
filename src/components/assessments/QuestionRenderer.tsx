import type { AssessmentQuestion, QuizAnswer } from '../../data/assessments';
import styles from './Quiz.module.css';

interface Props {
  question: AssessmentQuestion;
  answer: QuizAnswer;
  onChange: (answer: QuizAnswer) => void;
}

const moveItem = (items: string[], index: number, direction: -1 | 1) => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export default function QuestionRenderer({ question, answer, onChange }: Props) {
  if (question.type === 'single-choice') {
    return <fieldset className={styles.options}>
      <legend className="sr-only">Selecciona una respuesta</legend>
      {question.options.map((option) => <label className={`${styles.option} ${answer === option.id ? styles.selected : ''}`} key={option.id}>
        <input type="radio" name={question.id} value={option.id} checked={answer === option.id} onChange={() => onChange(option.id)} />
        <span className={styles.control} aria-hidden="true" />
        <span>{option.label}</span>
      </label>)}
    </fieldset>;
  }

  if (question.type === 'multiple-choice') {
    const selected = Array.isArray(answer) ? answer : [];
    return <fieldset className={styles.options}>
      <legend className={styles.helper}>Selecciona todas las respuestas correctas.</legend>
      {question.options.map((option) => <label className={`${styles.option} ${selected.includes(option.id) ? styles.selected : ''}`} key={option.id}>
        <input type="checkbox" value={option.id} checked={selected.includes(option.id)} onChange={() => onChange(selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id])} />
        <span className={`${styles.control} ${styles.checkbox}`} aria-hidden="true" />
        <span>{option.label}</span>
      </label>)}
    </fieldset>;
  }

  if (question.type === 'true-false') {
    return <fieldset className={`${styles.options} ${styles.booleanOptions}`}>
      <legend className="sr-only">Selecciona verdadero o falso</legend>
      {[{ value: true, label: 'Verdadero' }, { value: false, label: 'Falso' }].map((option) => <label className={`${styles.option} ${answer === option.value ? styles.selected : ''}`} key={String(option.value)}>
        <input type="radio" name={question.id} checked={answer === option.value} onChange={() => onChange(option.value)} />
        <span className={styles.control} aria-hidden="true" />
        <span>{option.label}</span>
      </label>)}
    </fieldset>;
  }

  if (question.type === 'ordering') {
    const order = Array.isArray(answer) && answer.length === question.options.length ? answer : question.options.map((option) => option.id);
    return <div className={styles.ordering}>
      <p className={styles.helper}>Usa los controles para colocar los pasos en el orden correcto.</p>
      <ol>
        {order.map((id, index) => {
          const option = question.options.find((item) => item.id === id);
          if (!option) return null;
          return <li key={id}>
            <span className={styles.orderNumber}>{index + 1}</span>
            <span>{option.label}</span>
            <span className={styles.orderControls}>
              <button type="button" disabled={index === 0} onClick={() => onChange(moveItem(order, index, -1))} aria-label={`Subir ${option.label}`}>↑</button>
              <button type="button" disabled={index === order.length - 1} onClick={() => onChange(moveItem(order, index, 1))} aria-label={`Bajar ${option.label}`}>↓</button>
            </span>
          </li>;
        })}
      </ol>
    </div>;
  }

  return <div className={styles.numericField}>
    <label htmlFor={`${question.id}-number`}>Respuesta numérica</label>
    <div><input id={`${question.id}-number`} type="number" inputMode="decimal" step="any" placeholder={question.placeholder} value={typeof answer === 'number' ? answer : ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />{question.unit && <span>{question.unit}</span>}</div>
  </div>;
}

