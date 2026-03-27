/**
 * Confetti — Pure CSS confetti celebration animation.
 * No external libraries. Auto-dismisses after 2s.
 * Respects prefers-reduced-motion.
 */
import { useEffect, useState } from 'react';

const COLORS = [
  '#10b981', // emerald-500
  '#0ea5e9', // sky-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
];

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
  rotation: number;
}

export function Confetti({ trigger }: { trigger: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const newParticles: Particle[] = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.3,
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
    }));
    setParticles(newParticles);
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!visible || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.size > 7 ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall {
          animation: confetti-fall 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
