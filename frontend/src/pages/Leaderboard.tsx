/**
 * Leaderboard.tsx — Gamification leaderboard page
 * Route: /leaderboard
 * Only visible when gamificationEnabled = true
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Star, Zap, Medal, Crown } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/stores/appStore';
import {
  getLeaderboard, getWeeklyLeaderboard, loadProfile,
  type LeaderboardEntry, type GamificationBadge,
} from '@/services/gamificationService';

// ─── Rank colours ─────────────────────────────────────────────────────────────
const RANK_COLORS: Record<string, string> = {
  Legend:   'text-purple-400',
  Master:   'text-yellow-400',
  Expert:   'text-blue-400',
  Scholar:  'text-green-400',
  Explorer: 'text-cyan-400',
  Novice:   'text-surface-400',
};

const RARITY_COLORS: Record<string, string> = {
  legendary: 'border-purple-500 bg-purple-500/10 text-purple-300',
  epic:      'border-blue-500 bg-blue-500/10 text-blue-300',
  rare:      'border-cyan-500 bg-cyan-500/10 text-cyan-300',
  common:    'border-surface-600 bg-surface-700/50 text-surface-300',
};

function PositionIcon({ pos }: { pos: number }) {
  if (pos === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
  if (pos === 2) return <Medal className="w-5 h-5 text-surface-300" />;
  if (pos === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-surface-400 font-bold text-sm w-5 text-center">{pos}</span>;
}

function LeaderRow({ entry, pos }: { entry: LeaderboardEntry; pos: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: pos * 0.04 }}
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
        entry.isYou
          ? 'bg-primary-500/10 border-primary-500/40 ring-1 ring-primary-500/20'
          : 'bg-surface-800/60 border-surface-700/40 hover:bg-surface-700/40'
      )}
    >
      <div className="w-7 flex justify-center flex-shrink-0">
        <PositionIcon pos={pos} />
      </div>

      {/* Avatar initials */}
      <div className={clsx(
        'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
        entry.isYou ? 'bg-primary-500 text-white' : 'bg-surface-600 text-surface-200'
      )}>
        {entry.name.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={clsx('font-semibold text-sm', entry.isYou ? 'text-primary-300' : 'text-white')}>
            {entry.name}
          </span>
          <span className={clsx('text-xs font-medium', RANK_COLORS[entry.rank] ?? 'text-surface-400')}>
            {entry.rank}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-surface-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-400" />
            {entry.xp.toLocaleString()} XP
          </span>
          <span className="text-xs text-surface-400 flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-400" />
            {entry.streak}d
          </span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-xs text-surface-400">Lv</div>
        <div className="text-lg font-black text-yellow-400 leading-none">{entry.level}</div>
      </div>
    </motion.div>
  );
}

function BadgeCard({ badge }: { badge: GamificationBadge }) {
  return (
    <div className={clsx(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm',
      RARITY_COLORS[badge.rarity]
    )}>
      <span className="text-2xl flex-shrink-0">{badge.emoji}</span>
      <div>
        <div className="font-semibold">{badge.name}</div>
        <div className="text-xs opacity-70">{badge.description}</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Leaderboard() {
  const { gamificationEnabled } = useAppStore();
  const [tab, setTab] = useState<'weekly' | 'alltime'>('weekly');
  const profile = loadProfile();
  const allTime = getLeaderboard();
  const weekly = getWeeklyLeaderboard();
  const entries = tab === 'weekly' ? weekly : allTime;

  if (!gamificationEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-surface-400">
        <Trophy className="w-12 h-12 mb-3 opacity-30" />
        <p className="font-medium">Gamification is disabled</p>
        <p className="text-sm mt-1">CEO/Admin can enable it in Settings → Advanced</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-2xl font-black text-white">Leaderboard</h1>
        <p className="text-surface-400 text-sm mt-1">Top learners in your cohort</p>
      </div>

      {/* Your stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Your XP', value: profile.xp.toLocaleString(), icon: <Zap className="w-4 h-4 text-yellow-400" /> },
          { label: 'Streak', value: `${profile.streak}d`, icon: <Flame className="w-4 h-4 text-orange-400" /> },
          { label: 'Level', value: profile.level, icon: <Star className="w-4 h-4 text-purple-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-surface-800 rounded-xl px-3 py-3 text-center border border-surface-700/50">
            <div className="flex justify-center mb-1">{s.icon}</div>
            <div className="text-xl font-black text-white">{s.value}</div>
            <div className="text-xs text-surface-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex bg-surface-800 rounded-xl p-1 gap-1">
        {(['weekly', 'alltime'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === t ? 'bg-primary-600 text-white shadow' : 'text-surface-400 hover:text-white'
            )}
          >
            {t === 'weekly' ? '⚡ This Week' : '🏆 All Time'}
          </button>
        ))}
      </div>

      {/* Rankings */}
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <LeaderRow key={entry.name} entry={entry} pos={i + 1} />
        ))}
      </div>

      {/* Badges */}
      {profile.badges.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-surface-300 mb-3 uppercase tracking-wider">Your Badges</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {profile.badges.map(b => <BadgeCard key={b.id} badge={b} />)}
          </div>
        </div>
      )}

      {profile.badges.length === 0 && (
        <div className="text-center py-6 text-surface-500">
          <p>🏅 Complete activities to earn badges!</p>
        </div>
      )}
    </div>
  );
}
