import { useEffect, useState } from 'react';

export const useGameTimer = (running: boolean, resetKey: number) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => { setSeconds(0); }, [resetKey]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running, resetKey]);

  return seconds;
};

export const formatGameTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export interface GameTrackingContext { courseSlug?: string; lessonSlug?: string }

export const saveGameAttempt = (gameSlug: string, durationSeconds: number, evidence: Record<string, unknown>, context: GameTrackingContext) =>
  fetch('/api/progress/game', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ gameSlug, durationSeconds, evidence, ...context }) }).catch(() => undefined);
