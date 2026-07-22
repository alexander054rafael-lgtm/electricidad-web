import { useEffect, useRef, useState } from 'react';
import styles from './Games.module.css';
import { formatGameTime, saveGameAttempt, useGameTimer, type GameTrackingContext } from './useGameTimer';

export default function SynchronousSpeedGame(context: GameTrackingContext) {
  const [frequency, setFrequency] = useState('');
  const [poles, setPoles] = useState('');
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const seconds = useGameTimer(result === null, resetKey);
  const saved = useRef(false);
  useEffect(() => { if (result !== null && !saved.current) { saved.current = true; void saveGameAttempt('synchronous-speed', seconds, { frequency:Number(frequency), poles:Number(poles), result }, context); } }, [context.courseSlug, context.lessonSlug, frequency, poles, result, seconds]);

  const calculate = () => {
    const f = Number(frequency);
    const p = Number(poles);
    if (!Number.isFinite(f) || f < 1 || f > 400) { setError('Ingresa una frecuencia válida entre 1 y 400 Hz.'); setResult(null); return; }
    if (!Number.isInteger(p) || p < 2 || p > 24 || p % 2 !== 0) { setError('El número de polos debe ser un entero par entre 2 y 24.'); setResult(null); return; }
    setError(''); setResult((120 * f) / p);
  };
  const reset = () => { saved.current = false; setFrequency(''); setPoles(''); setResult(null); setError(''); setResetKey((value) => value + 1); };

  return <div className={styles.game}>
    <div className={styles.toolbar}><div className={styles.metrics}><div className={styles.metric}><span>Puntaje</span><strong>{result === null ? 0 : 100} / 100</strong></div><div className={styles.metric}><span>Tiempo</span><strong>{formatGameTime(seconds)}</strong></div></div><button className={styles.reset} type="button" onClick={reset}>Reiniciar</button></div>
    <p className={styles.instruction}>Introduce la frecuencia de alimentación y el número total de polos. La calculadora aplicará Ns = 120 × f / p y mostrará cada paso.</p>
    <div className={styles.calculatorForm}>
      <div className={styles.field}><label htmlFor={`frequency-${resetKey}`}>Frecuencia</label><div className={styles.inputGroup}><input id={`frequency-${resetKey}`} type="number" inputMode="decimal" min="1" max="400" step="0.1" value={frequency} onChange={(event) => { setFrequency(event.target.value); setResult(null); setError(''); }} placeholder="60" /><span>Hz</span></div></div>
      <div className={styles.field}><label htmlFor={`poles-${resetKey}`}>Número de polos</label><div className={styles.inputGroup}><input id={`poles-${resetKey}`} type="number" inputMode="numeric" min="2" max="24" step="2" value={poles} onChange={(event) => { setPoles(event.target.value); setResult(null); setError(''); }} placeholder="4" /><span>polos</span></div></div>
      <button className={styles.primaryButton} type="button" onClick={calculate}>Calcular velocidad</button>
    </div>
    {error && <p className={styles.feedback} data-tone="error" role="alert">{error}</p>}
    {result !== null && <div className={styles.calculation} aria-live="polite"><div className={styles.result}><span>Velocidad sincrónica</span><strong>{Number.isInteger(result) ? result : result.toFixed(2)} RPM</strong></div><div className={styles.procedure}><h3>Procedimiento</h3><ol><li>Fórmula: Ns = 120 × f / p</li><li>Sustitución: Ns = 120 × {frequency} / {poles}</li><li>Multiplicación: 120 × {frequency} = {120 * Number(frequency)}</li><li>División: {120 * Number(frequency)} / {poles} = {Number.isInteger(result) ? result : result.toFixed(2)} RPM</li></ol><p className={styles.feedback} data-tone="success">El resultado representa la velocidad del campo magnético. La velocidad real del rotor será ligeramente menor cuando entregue torque.</p></div></div>}
  </div>;
}
