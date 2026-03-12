/**
 * ExamTimer — countdown timer for exam simulation
 * - Color transitions as time runs low
 * - Calls onExpire when time hits 0
 */
import { useState, useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';
import { clsx } from 'clsx';

interface ExamTimerProps {
  totalSeconds: number;
  onTick?: (secondsLeft: number) => void;
  onExpire?: () => void;
  paused?: boolean;
  className?: string;
}

export function ExamTimer({ totalSeconds, onTick, onExpire, paused = false, className }: ExamTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (paused || expiredRef.current) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        const next = prev - 1;
        onTick?.(next);
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true;
          clearInterval(interval);
          onExpire?.();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, onTick, onExpire]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const pct = secondsLeft / totalSeconds;

  const colorClass = pct > 0.4
    ? 'text-green-400'
    : pct > 0.15
    ? 'text-yellow-400'
    : 'text-red-400';

  const bgClass = pct > 0.4
    ? 'bg-green-900/30 border-green-800'
    : pct > 0.15
    ? 'bg-yellow-900/30 border-yellow-800'
    : 'bg-red-900/30 border-red-800 animate-pulse';

  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-1.5 rounded-full border',
      bgClass,
      className
    )}>
      <Timer className={clsx('w-4 h-4', colorClass)} />
      <span className={clsx('font-mono font-bold text-sm tabular-nums', colorClass)}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
