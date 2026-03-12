/**
 * LevelBadge — shows rank + level with color-coded styling
 */
import { loadProfile, type PlayerProfile, type PlayerRank } from '@/services/gamificationService';
import { useAppStore } from '@/stores/appStore';

const RANK_COLORS: Record<PlayerRank, string> = {
  Legend:   'text-purple-400',
  Master:   'text-yellow-400',
  Expert:   'text-blue-400',
  Scholar:  'text-green-400',
  Explorer: 'text-cyan-400',
  Novice:   'text-surface-400',
};

interface LevelBadgeProps {
  profile?: PlayerProfile;
  size?: 'sm' | 'md' | 'lg';
}

export function LevelBadge({ profile: profileProp, size = 'md' }: LevelBadgeProps) {
  const gamificationEnabled = useAppStore(s => s.gamificationEnabled);
  if (!gamificationEnabled) return null;

  const p = profileProp ?? loadProfile();
  const colorClass = RANK_COLORS[p.rank] ?? 'text-surface-400';

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium select-none ${sizeClasses[size]} ${colorClass} border-current/30 bg-surface-800`}
    >
      <span>Lv.{p.level}</span>
      <span className="opacity-70">·</span>
      <span>{p.rank}</span>
    </span>
  );
}
