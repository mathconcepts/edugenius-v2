/**
 * StreakBadge — Animated streak display with pulsing fire emoji.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/hooks/useApi';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  isActiveToday: boolean;
}

export function StreakBadge({ sessionId }: { sessionId: string }) {
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    apiFetch<StreakData>(`/api/streak/${sessionId}`)
      .then(setStreak)
      .catch(() => {});
  }, [sessionId]);

  if (!streak || streak.currentStreak === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/25"
      >
        <motion.span
          className="text-base"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          🔥
        </motion.span>
        <span className="text-sm font-bold text-orange-400">{streak.currentStreak}</span>
        <span className="text-xs text-surface-400">day streak</span>
      </motion.div>
    </AnimatePresence>
  );
}
