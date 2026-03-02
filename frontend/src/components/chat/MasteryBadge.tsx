/**
 * MasteryBadge.tsx
 *
 * Inline celebration component shown when Sage detects concept mastery.
 * Fired by LensEngine when: masteryScore >= 0.85 && consecutiveCorrect >= 3.
 *
 * Displays briefly, then auto-dismisses.
 */

import React, { useEffect, useState } from 'react';

interface MasteryBadgeProps {
  topicName: string;
  masteryScore: number; // 0-1
  onDismiss?: () => void;
}

export const MasteryBadge: React.FC<MasteryBadgeProps> = ({
  topicName,
  masteryScore,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  if (!visible) return null;

  const pct = Math.round(masteryScore * 100);

  return (
    <div className="mt-3 flex items-center gap-3 p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-2xl">🏆</div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-emerald-300">
          Concept Mastered! — {topicName}
        </p>
        <p className="text-xs text-emerald-400/80 mt-0.5">
          Mastery score: {pct}% · Keep it up 🔥
        </p>
      </div>
      <button
        onClick={() => { setVisible(false); onDismiss?.(); }}
        className="text-xs p-1 rounded-lg hover:bg-white/10 text-emerald-500/60 hover:text-emerald-300 transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};

export default MasteryBadge;
