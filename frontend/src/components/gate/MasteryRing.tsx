/**
 * MasteryRing — SVG circular progress indicator.
 * Color auto-selects: red (<40%) → amber (40-70%) → emerald (>70%).
 */
import { useEffect, useState } from 'react';

interface MasteryRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}

export function MasteryRing({
  value,
  size = 40,
  strokeWidth = 3,
  className = '',
  children,
}: MasteryRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedValue / 100) * circumference;

  // Animate on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  // Color based on value
  let strokeColor = 'stroke-red-500';
  let bgColor = 'stroke-red-500/20';
  if (value >= 70) {
    strokeColor = 'stroke-emerald-500';
    bgColor = 'stroke-emerald-500/20';
  } else if (value >= 40) {
    strokeColor = 'stroke-amber-500';
    bgColor = 'stroke-amber-500/20';
  }

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={bgColor}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={strokeColor}
          style={{
            transition: reducedMotion ? 'none' : 'stroke-dashoffset 0.8s ease-out',
          }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
