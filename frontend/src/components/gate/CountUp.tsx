/**
 * CountUp — Animates a number from 0 to target value.
 * Duration: 800ms with easeOut. Respects reduced motion.
 */
import { useEffect, useState } from 'react';

interface CountUpProps {
  target: number;
  duration?: number;
  suffix?: string;
  className?: string;
}

export function CountUp({ target, duration = 800, suffix = '', className = '' }: CountUpProps) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    const startTime = performance.now();
    let raf: number;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOut curve
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      }
    }

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <span className={className}>{value}{suffix}</span>;
}
