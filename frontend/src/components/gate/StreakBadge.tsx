/**
 * StreakBadge — Shows consecutive-day streak count.
 * Fires on mount, shows fire emoji + count.
 */

import { useState, useEffect } from 'react';
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
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/25">
      <span className="text-base">🔥</span>
      <span className="text-sm font-bold text-orange-400">{streak.currentStreak}</span>
      <span className="text-xs text-surface-400">day streak</span>
    </div>
  );
}
