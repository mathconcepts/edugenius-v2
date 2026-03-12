/**
 * StreakCard — shows current streak, longest streak, gems, and weekly XP
 */
import { useState, useEffect } from 'react';
import { Flame, Gem, TrendingUp, Trophy } from 'lucide-react';
import { loadProfile, updateStreak, type PlayerProfile } from '@/services/gamificationService';
import { useAppStore } from '@/stores/appStore';

interface StreakCardProps {
  className?: string;
}

export function StreakCard({ className = '' }: StreakCardProps) {
  const gamificationEnabled = useAppStore(s => s.gamificationEnabled);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    if (!gamificationEnabled) return;
    const p = updateStreak(); // update streak on mount
    setProfile(p);
  }, [gamificationEnabled]);

  if (!gamificationEnabled || !profile) return null;

  const stats = [
    {
      icon: <Flame className="w-4 h-4 text-orange-400" />,
      label: 'Streak',
      value: `${profile.streak}d`,
      sub: `Best: ${profile.longestStreak}d`,
    },
    {
      icon: <TrendingUp className="w-4 h-4 text-yellow-400" />,
      label: 'Weekly XP',
      value: profile.weeklyXP.toLocaleString(),
      sub: 'This week',
    },
    {
      icon: <Gem className="w-4 h-4 text-cyan-400" />,
      label: 'Gems',
      value: profile.gems.toLocaleString(),
      sub: 'Collect more',
    },
    {
      icon: <Trophy className="w-4 h-4 text-purple-400" />,
      label: 'Badges',
      value: String(profile.badges.length),
      sub: 'Earned',
    },
  ];

  return (
    <div className={`rounded-xl bg-surface-800 border border-surface-700 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-medium text-white">Your Progress</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div key={s.label} className="flex items-start gap-2">
            <div className="mt-0.5">{s.icon}</div>
            <div>
              <div className="text-base font-bold text-white leading-none">{s.value}</div>
              <div className="text-xs text-surface-400 mt-0.5">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
