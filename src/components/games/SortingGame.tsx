import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Games.module.css';
import { formatGameTime, saveGameAttempt, useGameTimer, type GameTrackingContext } from './useGameTimer';

const steps = [
  { id: 'safety', label: 'Revisar seguridad, desenergizar y aplicar bloqueo' },
  { id: 'install', label: 'Instalar físicamente el variador' },
  { id: 'power', label: 'Conectar la alimentación eléctrica' },
  { id: 'motor', label: 'Conectar el motor a la salida del variador' },
  { id: 'parameters', label: 'Configurar datos de placa y parámetros' },
  { id: 'tests', label: 'Realizar inspecciones y pruebas controladas' },
];
const initialOrder = ['parameters', 'power', 'tests', 'safety', 'motor', 'install'];

export default function SortingGame(context: GameTrackingContext) {
  const [order, setOrder] = useState(initialOrder);
  const [moves, setMoves] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const seconds = useGameTimer(!completed, resetKey);
  const correctPositions = useMemo(() => order.filter((id, index) => id === steps[index].id).length, [order]);
  const score = completed ? 100 : correctPositions * 15;
  const saved = useRef(false);
  useEffect(() => { if (completed && !saved.current) { saved.current = true; void saveGameAttempt('sorting', seconds, { order, moves }, context); } }, [completed, context.courseSlug, context.lessonSlug, moves, order, seconds]);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next); setMoves((value) => value + 1); setChecked(false);
  };
  const validate = () => { setChecked(true); setCompleted(correctPositions === steps.length); };
  const reset = () => { saved.current = false; setOrder(initialOrder); setMoves(0); setCompleted(false); setChecked(false); setResetKey((value) => value + 1); };

  return <div className={styles.game}>
    <div className={styles.toolbar}><div className={styles.metrics}><div className={styles.metric}><span>Puntaje</span><strong>{score} / 100</strong></div><div className={styles.metric}><span>Tiempo</span><strong>{formatGameTime(seconds)}</strong></div></div><button className={styles.reset} type="button" onClick={reset}>Reiniciar</button></div>
    <p className={styles.instruction}>Ordena el procedimiento de instalación segura. Usa las flechas de cada fila; funcionan con mouse, pantalla táctil y teclado.</p>
    <ol className={styles.sortList}>{order.map((id, index) => { const step = steps.find((item) => item.id === id)!; return <li className={styles.sortItem} key={id}><span className={styles.sortNumber}>{index + 1}</span><span>{step.label}</span><span className={styles.sortControls}><button type="button" disabled={index === 0 || completed} onClick={() => move(index, -1)} aria-label={`Subir: ${step.label}`}>↑</button><button type="button" disabled={index === order.length - 1 || completed} onClick={() => move(index, 1)} aria-label={`Bajar: ${step.label}`}>↓</button></span></li>; })}</ol>
    <div className={styles.sortActions}><button className={styles.primaryButton} type="button" disabled={completed} onClick={validate}>Comprobar orden</button></div>
    <p className={styles.feedback} data-tone={completed ? 'success' : checked ? 'error' : 'neutral'} aria-live="polite">{completed ? `¡Procedimiento correcto! Lo completaste en ${moves} movimientos.` : checked ? `${correctPositions} de ${steps.length} pasos están en su posición. Revisa el orden y vuelve a comprobar.` : 'Consejo: la seguridad y el aislamiento de energía siempre van antes del cableado.'}</p>
  </div>;
}
