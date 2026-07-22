import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Games.module.css';
import { formatGameTime, saveGameAttempt, useGameTimer, type GameTrackingContext } from './useGameTimer';

const concepts = [
  { id: 'frequency', term: 'Frecuencia', definition: 'Cantidad de ciclos eléctricos por segundo, expresada en hertz.' },
  { id: 'poles', term: 'Número de polos', definition: 'Cantidad de polos magnéticos que determina la velocidad del campo.' },
  { id: 'speed', term: 'Velocidad sincrónica', definition: 'Velocidad teórica de giro del campo magnético del estator.' },
  { id: 'slip', term: 'Deslizamiento', definition: 'Diferencia relativa entre la velocidad sincrónica y la del rotor.' },
  { id: 'torque', term: 'Torque', definition: 'Momento de fuerza que produce el giro del eje del motor.' },
];

const shuffledDefinitions = (offset: number) => concepts.map((_, index) => concepts[(index + offset) % concepts.length]);

export default function MatchingGame(context: GameTrackingContext) {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState('Selecciona un concepto y después su definición.');
  const [resetKey, setResetKey] = useState(0);
  const definitions = useMemo(() => shuffledDefinitions((resetKey % (concepts.length - 1)) + 1), [resetKey]);
  const completed = matched.length === concepts.length;
  const seconds = useGameTimer(!completed, resetKey);
  const score = Math.max(0, matched.length * 20 - mistakes * 2);
  const saved = useRef(false);
  useEffect(() => { if (completed && !saved.current) { saved.current = true; void saveGameAttempt('matching', seconds, { matchedIds: matched, mistakes }, context); } }, [completed, context.courseSlug, context.lessonSlug, matched, mistakes, seconds]);

  const evaluate = (termId: string, definitionId: string) => {
    if (termId === definitionId) {
      const nextMatched = [...matched, termId];
      setMatched(nextMatched);
      setFeedback(nextMatched.length === concepts.length ? '¡Excelente! Relacionaste todos los conceptos.' : 'Relación correcta. Continúa con el siguiente par.');
    } else {
      setMistakes((value) => value + 1);
      setFeedback('No coinciden. Revisa ambas definiciones e inténtalo nuevamente.');
    }
    setSelectedTerm(null);
    setSelectedDefinition(null);
  };

  const chooseTerm = (id: string) => selectedDefinition ? evaluate(id, selectedDefinition) : setSelectedTerm(id);
  const chooseDefinition = (id: string) => selectedTerm ? evaluate(selectedTerm, id) : setSelectedDefinition(id);
  const reset = () => { saved.current = false; setSelectedTerm(null); setSelectedDefinition(null); setMatched([]); setMistakes(0); setFeedback('Selecciona un concepto y después su definición.'); setResetKey((value) => value + 1); };

  return <div className={styles.game}>
    <div className={styles.toolbar}><div className={styles.metrics}><div className={styles.metric}><span>Puntaje</span><strong>{score} / 100</strong></div><div className={styles.metric}><span>Tiempo</span><strong>{formatGameTime(seconds)}</strong></div></div><button className={styles.reset} type="button" onClick={reset}>Reiniciar</button></div>
    <p className={styles.instruction}>Elige un término y luego la definición correspondiente. También puedes comenzar por una definición. Usa Tab y Enter para jugar con teclado.</p>
    <div className={styles.matchingGrid}>
      <div className={styles.matchingColumn}><h3>Conceptos</h3>{concepts.map((item) => <button type="button" key={item.id} disabled={matched.includes(item.id)} className={`${styles.matchButton} ${selectedTerm === item.id ? styles.selected : ''} ${matched.includes(item.id) ? styles.matched : ''}`} onClick={() => chooseTerm(item.id)}>{matched.includes(item.id) ? '✓ ' : ''}{item.term}</button>)}</div>
      <div className={styles.matchingColumn}><h3>Definiciones</h3>{definitions.map((item) => <button type="button" key={item.id} disabled={matched.includes(item.id)} className={`${styles.matchButton} ${selectedDefinition === item.id ? styles.selected : ''} ${matched.includes(item.id) ? styles.matched : ''}`} onClick={() => chooseDefinition(item.id)}>{matched.includes(item.id) ? '✓ ' : ''}{item.definition}</button>)}</div>
    </div>
    <p className={styles.feedback} data-tone={completed ? 'success' : mistakes > 0 ? 'error' : 'neutral'} aria-live="polite">{feedback}</p>
  </div>;
}
