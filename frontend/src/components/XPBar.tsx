/**
 * XPBar.tsx — Compact XP / level / streak bar for headers & dashboards
 * Respects gamificationEnabled flag.
 */
import { useAppStore } from '@/stores/appStore';
import { loadProfile, getLevelProgress } from '@/services/gamificationService';

interface XPBarProps {
  compact?: boolean;
}

export function XPBar({ compact = false }: XPBarProps) {
  const { gamificationEnabled } = useAppStore();
  if (!gamificationEnabled) return null;

  const p = loadProfile();
  const pct = getLevelProgress(p);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-800 rounded-full text-xs select-none">
        <span className="text-yellow-400 font-bold">Lv.{p.level}</span>
        <div className="w-16 h-1.5 bg-surface-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
        <span className="text-orange-400 font-semibold">🔥{p.streak}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-800/80 rounded-xl border border-surface-700/50 select-none">
      {/* Level badge */}
      <div className="flex flex-col items-center w-10">
        <span className="text-xs text-surface-400">Lv</span>
        <span className="text-lg font-black text-yellow-400 leading-none">{p.level}</span>
      </div>

      {/* XP progress */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs text-surface-400 mb-1">
          <span className="font-medium text-white">{p.rank}</span>
          <span>{p.xp.toLocaleString()} XP</span>
        </div>
        <div className="h-2 bg-surface-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.max(3, pct)}%` }}
          />
        </div>
        {p.xpToNextLevel > 0 && (
          <p className="text-xs text-surface-500 mt-0.5">{p.xpToNextLevel} XP to next level</p>
        )}
      </div>

      {/* Streak */}
      <div className="flex flex-col items-center w-12">
        <span className="text-lg leading-none">🔥</span>
        <span className="text-sm font-bold text-orange-400">{p.streak}d</span>
      </div>

      {/* Gems */}
      <div className="flex flex-col items-center w-12">
        <span className="text-lg leading-none">💎</span>
        <span className="text-xs font-semibold text-cyan-400">{p.gems}</span>
      </div>
    </div>
  );
}
